import { DeviceConsoleParams, SpriteKind } from '../types/clinic';

export interface ActiveDeviceAudioInput {
  instanceId: string;
  sprite: SpriteKind;
  isRunning: boolean;
  placedCount: number;
  irIntensity?: number;
  irDistance?: number;
  isMoving?: boolean;
  deviceParams?: DeviceConsoleParams;
}

export type PatientReactionKind = 'electrical' | 'percussion' | 'thermal' | 'cold' | 'stretch';

export interface PatientReactionLiveInput {
  active: boolean;
  intensity01: number;
  pulse01: number;
  spike01: number;
  isFemale: boolean;
  kind: PatientReactionKind;
}

interface DeviceAudioHandle {
  sprite: SpriteKind;
  masterGain: GainNode;
  nodes: AudioNode[];
  src1?: AudioBufferSourceNode;
  pulseOsc?: OscillatorNode;
  pulseGain?: GainNode;
  filter1?: BiquadFilterNode;
  nextPulseAt: number;
  burstPhase: number;
}

interface EquipMoveHandle {
  masterGain: GainNode;
  rollLp: BiquadFilterNode;
  nodes: AudioNode[];
}

interface ActiveVoicePlayback {
  src: AudioBufferSourceNode;
  gain: GainNode;
}

const VOICE_SR = 24000;
const SFX_SR = 32000;

interface VoiceSynthSpec {
  dur: number;
  f0Start: number;
  f0Peak: number;
  f0End: number;
  f1Start: number;
  f1End: number;
  f2Start: number;
  f2End: number;
  bw1: number;
  bw2: number;
  voiceMix: number;
  breathMix: number;
  attackSec: number;
  isInhale?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private activeDevices = new Map<string, DeviceAudioHandle>();
  private equipMove: EquipMoveHandle | null = null;
  private activeVoice: ActiveVoicePlayback | null = null;
  private lastDeviceSyncAt = -1;
  private lastVoiceSyncAt = -1;
  private lastMoveSyncAt = -1;
  private lastAdjustCueAt = -1;
  private nextVoiceAt = 0;
  private lastVoiceSpikeAt = -1;
  private voiceVariantIdx = 0;
  public enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Shared warm clinic-room bus: dry signal + subtle 0.24s small-room reflections -> gentle warmth LP + limiter.
   * Gives every device, wheel, and patient breath natural physical room presence instead of bone-dry synth audio.
   */
  private getMasterBus(ctx: AudioContext): AudioNode {
    if (this.masterBus && this.masterBus.context === ctx) {
      return this.masterBus;
    }
    const input = ctx.createGain();
    input.gain.value = 1.0;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.92;

    // Tiny pre-computed small clinic room early reflections & damped air tail
    const irLen = Math.floor(ctx.sampleRate * 0.24);
    const irBuf = ctx.createBuffer(1, irLen, ctx.sampleRate);
    const irData = irBuf.getChannelData(0);
    let irLp = 0;
    for (let i = 0; i < irLen; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t / 0.068);
      const early = i === 180 || i === 420 || i === 790 ? 0.35 : 0;
      const raw = (Math.random() * 2 - 1) * env * 0.28 + early;
      irLp = irLp + 0.22 * (raw - irLp);
      irData[i] = irLp;
    }
    const roomConv = ctx.createConvolver();
    roomConv.buffer = irBuf;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.17;

    const warmLp = ctx.createBiquadFilter();
    warmLp.type = 'lowpass';
    warmLp.frequency.value = 5800;
    warmLp.Q.value = 0.55;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 16;
    comp.ratio.value = 3.0;
    comp.attack.value = 0.004;
    comp.release.value = 0.16;

    const outGain = ctx.createGain();
    outGain.gain.value = 1.32;

    input.connect(dryGain);
    input.connect(roomConv);
    roomConv.connect(wetGain);
    dryGain.connect(warmLp);
    wetGain.connect(warmLp);
    warmLp.connect(comp);
    comp.connect(outGain);
    outGain.connect(ctx.destination);

    this.masterBus = input;
    return input;
  }

  private clearCaches() {
    this.bufferCache.clear();
  }

  private makeSeamlessLoop(samples: Float32Array, sr: number, crossfadeSec = 0.15): AudioBuffer {
    const ctx = this.ctx!;
    const cf = Math.min(Math.floor(samples.length * 0.25), Math.floor(sr * crossfadeSec));
    const usable = samples.length - cf;
    const buf = ctx.createBuffer(1, usable, sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < usable; i++) {
      if (i < cf) {
        const w = i / cf;
        const a = Math.sin(w * Math.PI * 0.5);
        const b = Math.cos(w * Math.PI * 0.5);
        ch[i] = samples[i] * a + samples[usable + i] * b;
      } else {
        ch[i] = samples[i];
      }
    }
    return buf;
  }

  /**
   * Organic human breath & deeply muffled natural chest/throat sigh synthesizer.
   * Intentionally avoids narrow high-Q metallic vowel formants (F3/F4) so reactions always sound grounded and human.
   */
  private buildHumanVoiceBuffer(ctx: AudioContext, spec: VoiceSynthSpec): AudioBuffer {
    const sr = VOICE_SR;
    const n = Math.floor(sr * spec.dur);
    const raw = new Float32Array(n);

    let phase = 0;
    let jitter = 1;
    let shimmer = 1;
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    let y1a = 0, y2a = 0;
    let y1b = 0, y2b = 0;
    let dcX = 0, dcY = 0;
    let darkLp = 0;
    let airLp = 0;

    for (let i = 0; i < n; i++) {
      const tSec = i / sr;
      const u = i / n;

      // Natural human inflection curve
      let f0Base: number;
      if (u < 0.2) {
        f0Base = spec.f0Start + (spec.f0Peak - spec.f0Start) * Math.sin((u / 0.2) * Math.PI * 0.5);
      } else {
        f0Base = spec.f0Peak + (spec.f0End - spec.f0Peak) * Math.pow((u - 0.2) / 0.8, 0.78);
      }

      const f0 = f0Base * (1 + 0.008 * Math.sin(2 * Math.PI * 4.4 * tSec)) * jitter;
      phase += f0 / sr;
      if (phase >= 1) {
        phase -= 1;
        jitter = 1 + (Math.random() * 2 - 1) * 0.014;
        shimmer = 1 + (Math.random() * 2 - 1) * 0.06;
      }

      // Very soft warm glottal pulse (heavy fundamental + gentle 2nd harmonic, zero harsh upper buzz)
      let glot = 0;
      if (spec.voiceMix > 0.01) {
        const theta = 2 * Math.PI * phase;
        glot = (Math.sin(theta) * 0.82 + Math.sin(2 * theta - 0.4) * 0.18) * shimmer;
      }

      // Multi-stage warm organic air turbulence (nostril + throat airflow)
      const w = Math.random() * 2 - 1;
      b0 = 0.994 * b0 + w * 0.032;
      b1 = 0.965 * b1 + w * 0.055;
      b2 = 0.86 * b2 + w * 0.09;
      b3 = 0.65 * b3 + w * 0.08;
      const warmNoise = b0 * 1.1 + b1 * 0.9 + b2 * 0.55;
      const softAir = b2 * 0.35 + b3 * 0.25;

      // Gentle breath modulation tied to glottal phase when vocalizing
      const breathMod = spec.voiceMix > 0.02 ? 0.55 + 0.45 * Math.max(0, Math.sin(2 * Math.PI * phase)) : 1.0;
      const voiceSrc = glot * spec.voiceMix + warmNoise * breathMod * spec.breathMix * 0.55;

      // Wide, heavily damped 2-formant throat/mouth shaping (never sharp/metallic)
      const f1 = spec.f1Start + (spec.f1End - spec.f1Start) * u;
      const f2 = spec.f2Start + (spec.f2End - spec.f2Start) * u;

      const r1 = Math.exp((-Math.PI * spec.bw1) / sr);
      const c1 = -(r1 * r1);
      const k1 = 2 * r1 * Math.cos((2 * Math.PI * f1) / sr);
      const s1 = (1 - k1 - c1) * voiceSrc + k1 * y1a + c1 * y2a;
      y2a = y1a;
      y1a = s1;

      const r2 = Math.exp((-Math.PI * spec.bw2) / sr);
      const c2 = -(r2 * r2);
      const k2 = 2 * r2 * Math.cos((2 * Math.PI * f2) / sr);
      const s2 = (1 - k2 - c2) * s1 + k2 * y1b + c2 * y2b;
      y2b = y1b;
      y1b = s2;

      // Blend soft direct exhale air around the muffled throat hum
      airLp = airLp + 0.22 * (softAir * spec.breathMix - airLp);
      const combined = s2 * 0.72 + airLp * 0.52;

      const dcOut = combined - dcX + 0.994 * dcY;
      dcX = combined;
      dcY = dcOut;
      darkLp = darkLp + 0.26 * (dcOut - darkLp);

      // Organic breath envelope: smooth rise, vocal presence earlier, gentle breathy tail
      const att = Math.pow(Math.min(1, tSec / spec.attackSec), 1.3);
      const bodyEnv = spec.isInhale
        ? Math.sin(Math.pow(u, 0.7) * Math.PI)
        : Math.pow(Math.max(0, 1 - u), 0.82);
      const vocalTailGate = spec.voiceMix > 0.05 && u > 0.62 ? Math.max(0.15, 1 - (u - 0.62) * 2.2) : 1;
      const tailFade = u > 0.88 ? Math.max(0, (1 - u) / 0.12) : 1;
      raw[i] = darkLp * att * bodyEnv * vocalTailGate * tailFade;
    }

    let maxAbs = 0.0001;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(raw[i]);
      if (a > maxAbs) maxAbs = a;
    }
    const buf = ctx.createBuffer(1, n, sr);
    const ch = buf.getChannelData(0);
    const scale = 0.72 / maxAbs;
    for (let i = 0; i < n; i++) {
      ch[i] = Math.tanh(raw[i] * scale * 1.1);
    }
    return buf;
  }

  private getVoiceBuffer(ctx: AudioContext, key: string): AudioBuffer {
    const cached = this.bufferCache.get(key);
    if (cached && cached.sampleRate === VOICE_SR) return cached;

    let spec: VoiceSynthSpec;
    switch (key) {
      case 'm_breath_soft':
        spec = {
          dur: 0.48, f0Start: 98, f0Peak: 98, f0End: 92,
          f1Start: 380, f1End: 340, f2Start: 920, f2End: 840,
          bw1: 185, bw2: 260, voiceMix: 0.0, breathMix: 1.0, attackSec: 0.11,
        };
        break;
      case 'm_sigh_mild':
        spec = {
          dur: 0.44, f0Start: 100, f0Peak: 104, f0End: 88,
          f1Start: 310, f1End: 290, f2Start: 860, f2End: 780,
          bw1: 155, bw2: 240, voiceMix: 0.24, breathMix: 0.76, attackSec: 0.08,
        };
        break;
      case 'm_wince_0':
        spec = {
          dur: 0.36, f0Start: 104, f0Peak: 112, f0End: 90,
          f1Start: 380, f1End: 340, f2Start: 950, f2End: 860,
          bw1: 145, bw2: 220, voiceMix: 0.36, breathMix: 0.64, attackSec: 0.055,
        };
        break;
      case 'm_wince_1':
        spec = {
          dur: 0.40, f0Start: 100, f0Peak: 108, f0End: 86,
          f1Start: 350, f1End: 315, f2Start: 900, f2End: 820,
          bw1: 150, bw2: 230, voiceMix: 0.32, breathMix: 0.68, attackSec: 0.06,
        };
        break;
      case 'm_groan_0':
        spec = {
          dur: 0.44, f0Start: 110, f0Peak: 120, f0End: 92,
          f1Start: 430, f1End: 370, f2Start: 1000, f2End: 880,
          bw1: 135, bw2: 210, voiceMix: 0.44, breathMix: 0.56, attackSec: 0.045,
        };
        break;
      case 'm_groan_1':
        spec = {
          dur: 0.40, f0Start: 108, f0Peak: 116, f0End: 89,
          f1Start: 400, f1End: 350, f2Start: 960, f2End: 850,
          bw1: 140, bw2: 215, voiceMix: 0.40, breathMix: 0.60, attackSec: 0.042,
        };
        break;
      case 'm_gasp':
        spec = {
          dur: 0.21, f0Start: 118, f0Peak: 126, f0End: 106,
          f1Start: 420, f1End: 520, f2Start: 1050, f2End: 1180,
          bw1: 165, bw2: 250, voiceMix: 0.16, breathMix: 0.84, attackSec: 0.025, isInhale: true,
        };
        break;

      case 'f_breath_soft':
        spec = {
          dur: 0.46, f0Start: 180, f0Peak: 180, f0End: 168,
          f1Start: 430, f1End: 390, f2Start: 1060, f2End: 980,
          bw1: 190, bw2: 270, voiceMix: 0.0, breathMix: 1.0, attackSec: 0.1,
        };
        break;
      case 'f_sigh_mild':
        spec = {
          dur: 0.42, f0Start: 178, f0Peak: 186, f0End: 160,
          f1Start: 360, f1End: 330, f2Start: 1000, f2End: 920,
          bw1: 160, bw2: 245, voiceMix: 0.22, breathMix: 0.78, attackSec: 0.075,
        };
        break;
      case 'f_wince_0':
        spec = {
          dur: 0.35, f0Start: 184, f0Peak: 196, f0End: 164,
          f1Start: 430, f1End: 380, f2Start: 1080, f2End: 980,
          bw1: 150, bw2: 230, voiceMix: 0.34, breathMix: 0.66, attackSec: 0.05,
        };
        break;
      case 'f_wince_1':
        spec = {
          dur: 0.38, f0Start: 180, f0Peak: 190, f0End: 160,
          f1Start: 400, f1End: 360, f2Start: 1040, f2End: 950,
          bw1: 155, bw2: 235, voiceMix: 0.30, breathMix: 0.70, attackSec: 0.055,
        };
        break;
      case 'f_groan_0':
        spec = {
          dur: 0.42, f0Start: 190, f0Peak: 206, f0End: 166,
          f1Start: 480, f1End: 410, f2Start: 1120, f2End: 1000,
          bw1: 142, bw2: 220, voiceMix: 0.40, breathMix: 0.60, attackSec: 0.042,
        };
        break;
      case 'f_groan_1':
        spec = {
          dur: 0.38, f0Start: 188, f0Peak: 200, f0End: 162,
          f1Start: 450, f1End: 390, f2Start: 1080, f2End: 960,
          bw1: 148, bw2: 225, voiceMix: 0.36, breathMix: 0.64, attackSec: 0.04,
        };
        break;
      case 'f_gasp':
      default:
        spec = {
          dur: 0.20, f0Start: 198, f0Peak: 212, f0End: 182,
          f1Start: 460, f1End: 560, f2Start: 1160, f2End: 1280,
          bw1: 170, bw2: 260, voiceMix: 0.14, breathMix: 0.86, attackSec: 0.024, isInhale: true,
        };
        break;
    }

    const buf = this.buildHumanVoiceBuffer(ctx, spec);
    this.bufferCache.set(key, buf);
    return buf;
  }

  /**
   * Pre-rendered realistic physical/medical hardware SFX & seamless loops.
   */
  private getDeviceBuffer(ctx: AudioContext, key: string): AudioBuffer {
    const cached = this.bufferCache.get(key);
    if (cached && cached.sampleRate === SFX_SR) return cached;

    const sr = SFX_SR;
    let buf: AudioBuffer;

    if (key === 'tens_tick') {
      // Tactile crisp clinical micro-impulse (short transient + warm damped rubber/skin thump, zero watch beep)
      const n = Math.floor(sr * 0.014);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const transient = (Math.random() * 2 - 1) * Math.exp(-t / 0.00085) * 0.72;
        lp = lp + 0.42 * (transient - lp);
        const body = Math.sin(2 * Math.PI * 165 * t) * Math.exp(-t / 0.0034) * 0.52;
        const click = Math.sin(2 * Math.PI * 980 * t) * Math.exp(-t / 0.0011) * 0.34;
        ch[i] = Math.tanh((lp + body + click) * 1.15) * 0.84;
      }
    } else if (key === 'eswt_shot') {
      // Authentic dry radial shockwave applicator tap ("تَكْ") + tight pneumatic release puff
      const n = Math.floor(sr * 0.078);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let airLp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        // Hard ceramic/polymer projectile snap (multi-harmonic fast decay, no retro chirp)
        const snap =
          (Math.sin(2 * Math.PI * 760 * t) * 0.45 +
            Math.sin(2 * Math.PI * 1340 * t) * 0.35 +
            Math.sin(2 * Math.PI * 2150 * t) * 0.2) *
          Math.exp(-t / 0.0018);
        const body = Math.sin(2 * Math.PI * (128 - t * 650) * Math.max(0, t)) * Math.exp(-t / 0.012) * 0.65;
        const w = Math.random() * 2 - 1;
        airLp = airLp + 0.32 * (w - airLp);
        const puff = (w - airLp) * Math.exp(-t / 0.009) * 0.42;
        ch[i] = Math.tanh((snap * 0.95 + body + puff) * 1.2) * 0.88;
      }
    } else if (key === 'pad_stick') {
      // Wet hydrogel pad suction press onto skin
      const n = Math.floor(sr * 0.068);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.sin(Math.min(1, t / 0.012) * Math.PI * 0.5) * Math.exp(-t / 0.018);
        const pop = Math.sin(2 * Math.PI * (185 - t * 1400) * t) * env * 0.72;
        lp = lp + 0.25 * ((Math.random() * 2 - 1) - lp);
        const tack = lp * Math.exp(-t / 0.009) * 0.48;
        ch[i] = Math.tanh((pop + tack) * 1.2) * 0.84;
      }
    } else if (key === 'switch_click') {
      // Clean tactile console switch micro-snap
      const n = Math.floor(sr * 0.018);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const hit =
          (Math.sin(2 * Math.PI * 1150 * t) * 0.5 +
            Math.sin(2 * Math.PI * 2400 * t) * 0.35 +
            (Math.random() * 2 - 1) * 0.25) *
          Math.exp(-t / 0.0016);
        ch[i] = Math.tanh(hit * 1.2) * 0.82;
      }
    } else if (key === 'equip_thud') {
      // Rubber/metal equipment set-down/grab thud
      const n = Math.floor(sr * 0.095);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const thud = Math.sin(2 * Math.PI * (108 * Math.exp(-t * 14) + 46) * t) * Math.exp(-t / 0.024) * 0.82;
        const rattle = Math.sin(2 * Math.PI * 340 * t) * Math.exp(-t / 0.008) * 0.22;
        lp = lp + 0.2 * ((Math.random() * 2 - 1) - lp);
        ch[i] = Math.tanh((thud + rattle + lp * Math.exp(-t / 0.016) * 0.3) * 1.2) * 0.86;
      }
    } else if (key === 'eswt_comp_loop') {
      // Quiet medical air compressor motor chug (~17 Hz piston pulse + smooth damped cabinet hum)
      const dur = 1.6;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const piston = 0.65 + 0.35 * Math.sin(2 * Math.PI * 17 * t);
        const motor =
          Math.sin(2 * Math.PI * 52 * t) * 0.45 +
          Math.sin(2 * Math.PI * 104 * t) * 0.22 +
          Math.sin(2 * Math.PI * 156 * t) * 0.08;
        lp = lp + 0.09 * ((Math.random() * 2 - 1) - lp);
        raw[i] = (motor * piston + lp * 0.85) * 0.55;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'cpm_motor_loop') {
      // Realistic quiet brushed DC linear actuator / worm gear motor hum
      const dur = 1.6;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const gear =
          Math.sin(2 * Math.PI * 118 * t) * 0.38 +
          Math.sin(2 * Math.PI * 236 * t) * 0.22 +
          Math.sin(2 * Math.PI * 354 * t) * 0.09;
        const ripple = 0.88 + 0.12 * Math.sin(2 * Math.PI * 11 * t);
        lp = lp + 0.08 * ((Math.random() * 2 - 1) - lp);
        raw[i] = (gear * ripple + lp * 0.42) * 0.65;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'cryo_pump_loop') {
      // Rhythmic diaphragm cryo-compression pump + smooth chilled fluid tube flow
      const dur = 1.8;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        b0 = 0.992 * b0 + w * 0.035;
        b1 = 0.94 * b1 + b0 * 0.12;
        const pump = 0.72 + 0.28 * Math.sin(2 * Math.PI * 3.1 * t);
        const hum = Math.sin(2 * Math.PI * 56 * t) * 0.26 + Math.sin(2 * Math.PI * 112 * t) * 0.12;
        raw[i] = (b1 * 0.85 + hum) * pump;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'us_gel_loop') {
      // Quiet cabinet cooling fan + ultra-gentle warm transducer acoustic coupling purr
      const dur = 1.8;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        b0 = 0.994 * b0 + w * 0.03;
        b1 = 0.93 * b1 + b0 * 0.1;
        const transducer = Math.sin(2 * Math.PI * 108 * t) * 0.16 + Math.sin(2 * Math.PI * 216 * t) * 0.06;
        raw[i] = b1 * 0.75 + transducer;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'hydro_water_loop') {
      // Rich multi-layered warm water swirling & rising micro-bubbles
      const dur = 2.8;
      const n = Math.floor(sr * (dur + 0.16));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.986 * b0 + w * 0.024;
        b1 = 0.935 * b1 + b0 * 0.15;
        raw[i] = b1 * 0.3;
      }
      for (let k = 0; k < 75; k++) {
        const start = Math.floor(Math.random() * (n - Math.floor(sr * 0.06)));
        const bDur = 0.018 + Math.random() * 0.034;
        const bLen = Math.floor(sr * bDur);
        const f0 = 240 + Math.random() * 580;
        const amp = 0.065 + Math.random() * 0.13;
        for (let j = 0; j < bLen && start + j < n; j++) {
          const u = j / bLen;
          const freq = f0 * (1 + 0.52 * u);
          const env = Math.sin(u * Math.PI) * Math.exp(-u * 1.75);
          raw[start + j] += Math.sin(2 * Math.PI * freq * (j / sr)) * env * amp;
        }
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.16);
    } else if (key === 'cart_roll_loop') {
      // Rubber caster wheels rolling softly across tiled clinic floor
      const dur = 1.6;
      const n = Math.floor(sr * (dur + 0.14));
      const raw = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        lp = lp + 0.045 * (w - lp);
        const tilePhase = (t * 5.2) % 1;
        const bump = tilePhase < 0.075 ? Math.sin((tilePhase / 0.075) * Math.PI) * 0.4 : 0;
        raw[i] = lp * 1.35 + bump * (lp * 1.6 + Math.sin(2 * Math.PI * 78 * t) * 0.14);
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.14);
    } else {
      // Clean medical cabinet fan whisper
      const dur = 1.8;
      const n = Math.floor(sr * (dur + 0.16));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.996 * b0 + w * 0.026;
        b1 = 0.982 * b1 + w * 0.03;
        b2 = 0.925 * b2 + w * 0.04;
        raw[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2) * 1.15));
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.16);
    }

    this.bufferCache.set(key, buf);
    return buf;
  }

  private playBufferOneShot(ctx: AudioContext, buf: AudioBuffer, volume: number, rate = 1.0, delay = 0) {
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(this.getMasterBus(ctx));
    src.start(now);
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.09, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.getMasterBus(ctx));
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  tap() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.1, 1.05);
  }

  placeItem() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'equip_thud'), 0.16, 1.15);
    this.playTone(340, 0.08, 'sine', 0.06, 0.025);
  }

  coin() {
    this.playTone(987.77, 0.08, 'sine', 0.085, 0);
    this.playTone(1318.51, 0.15, 'sine', 0.085, 0.055);
  }

  starSuccess() {
    this.playTone(523.25, 0.09, 'sine', 0.08, 0);
    this.playTone(659.25, 0.09, 'sine', 0.08, 0.08);
    this.playTone(783.99, 0.11, 'sine', 0.08, 0.16);
    this.playTone(1046.5, 0.2, 'sine', 0.09, 0.24);
  }

  alert() {
    this.playTone(340, 0.11, 'triangle', 0.075, 0);
    this.playTone(280, 0.15, 'triangle', 0.075, 0.1);
  }

  padStick() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'pad_stick'), 0.16, 0.96 + Math.random() * 0.08);
  }

  deviceToggle(on: boolean) {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.13, on ? 1.12 : 0.88);
    if (on) {
      this.playTone(880, 0.06, 'sine', 0.065, 0.02);
    } else {
      this.playTone(460, 0.065, 'sine', 0.055, 0.02);
    }
  }

  fppEquipGrab(isRollingCart: boolean) {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(
      ctx,
      this.getDeviceBuffer(ctx, 'equip_thud'),
      isRollingCart ? 0.14 : 0.11,
      isRollingCart ? 1.15 : 1.38
    );
    if (isRollingCart) {
      this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.09, 0.9, 0.018);
    }
  }

  fppEquipPlace(isRollingCart: boolean, nearBed: boolean) {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(
      ctx,
      this.getDeviceBuffer(ctx, 'equip_thud'),
      isRollingCart ? 0.2 : 0.14,
      isRollingCart ? 0.88 : 1.05
    );
    if (nearBed) {
      this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.11, 0.85, 0.035);
    }
  }

  fppEquipReturn() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'equip_thud'), 0.1, 1.25);
  }

  fppEquipAdjust(timeSec: number) {
    if (timeSec - this.lastAdjustCueAt < 0.22) return;
    this.lastAdjustCueAt = timeSec;
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.055, 0.72);
  }

  syncFppEquipMove(isMovingHeld: boolean, speed01: number, isRollingCart: boolean, timeSec: number) {
    if (!this.enabled) {
      if (this.equipMove) this.disposeEquipMove(this.ctx);
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!isMovingHeld && !this.equipMove) return;

    if (timeSec - this.lastMoveSyncAt < 0.036) return;
    this.lastMoveSyncAt = timeSec;

    if (!this.equipMove && isMovingHeld) {
      const out = this.getMasterBus(ctx);
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.0001;
      masterGain.connect(out);

      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, 'cart_roll_loop');
      src.loop = true;

      const rollLp = ctx.createBiquadFilter();
      rollLp.type = 'lowpass';
      rollLp.frequency.value = 280;
      rollLp.Q.value = 0.65;

      src.connect(rollLp);
      rollLp.connect(masterGain);
      src.start(ctx.currentTime);
      this.equipMove = {
        masterGain,
        rollLp,
        nodes: [src, rollLp, masterGain],
      };
    }

    const em = this.equipMove;
    if (!em) return;
    const now = ctx.currentTime;
    const clampedSpd = isMovingHeld ? Math.max(0, Math.min(1, speed01)) : 0;

    if (clampedSpd < 0.04) {
      em.masterGain.gain.setTargetAtTime(0.0001, now, 0.055);
      return;
    }

    const baseVol = isRollingCart ? 0.042 + clampedSpd * 0.13 : 0.012 + clampedSpd * 0.03;
    em.masterGain.gain.setTargetAtTime(baseVol, now, 0.045);
    em.rollLp.frequency.setTargetAtTime((isRollingCart ? 210 : 320) + clampedSpd * 240, now, 0.05);
  }

  private disposeEquipMove(ctx: AudioContext | null) {
    const em = this.equipMove;
    if (!em) return;
    this.equipMove = null;
    this.disposeNodeList(ctx, em.masterGain, em.nodes);
  }

  private playVoiceClip(ctx: AudioContext, key: string, volume: number, rateOffset = 1.0) {
    const now = ctx.currentTime;
    if (this.activeVoice) {
      const prev = this.activeVoice;
      try {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setTargetAtTime(0.0001, now, 0.018);
        prev.src.stop(now + 0.07);
      } catch {
        // Ignore
      }
      this.activeVoice = null;
    }

    const buf = this.getVoiceBuffer(ctx, key);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rateOffset;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0005, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.025);
    gain.connect(this.getMasterBus(ctx));

    src.connect(gain);
    src.onended = () => {
      if (this.activeVoice?.src === src) {
        this.activeVoice = null;
      }
      try {
        src.disconnect();
        gain.disconnect();
      } catch {
        // Ignore
      }
    };
    src.start(now);
    this.activeVoice = { src, gain };
  }

  syncPatientReaction(input: PatientReactionLiveInput, timeSec: number) {
    if (!this.enabled || !input.active) {
      if (this.activeVoice && this.ctx) {
        const now = this.ctx.currentTime;
        try {
          this.activeVoice.gain.gain.setTargetAtTime(0.0001, now, 0.04);
        } catch {
          // Ignore
        }
      }
      this.nextVoiceAt = 0;
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;

    if (timeSec - this.lastVoiceSyncAt < 0.036) return;
    this.lastVoiceSyncAt = timeSec;

    const lvl = Math.max(0, Math.min(1.25, input.intensity01));
    if (lvl < 0.25 && input.spike01 < 0.34) return;

    if (this.nextVoiceAt === 0 && input.spike01 < 0.34) {
      this.nextVoiceAt = timeSec + (lvl >= 0.68 ? 0.65 : 2.8);
      return;
    }

    const prefix = input.isFemale ? 'f_' : 'm_';
    const isSpike = input.spike01 >= 0.34 && lvl >= 0.48 && timeSec - this.lastVoiceSpikeAt >= 1.1;
    const isPeriodicDue = timeSec >= this.nextVoiceAt;

    if (!isSpike && !isPeriodicDue) return;

    this.voiceVariantIdx = (this.voiceVariantIdx + 1) % 2;
    const rateJitter = 0.96 + Math.random() * 0.08;

    let clipKey: string;
    let vol: number;
    let nextDelay: number;

    if (isSpike) {
      this.lastVoiceSpikeAt = timeSec;
      if (lvl >= 0.88) {
        clipKey = `${prefix}groan_${this.voiceVariantIdx}`;
        vol = Math.min(0.4, 0.28 + lvl * 0.1);
        nextDelay = 2.0 + Math.random() * 0.7;
      } else if (lvl >= 0.68) {
        clipKey = input.kind === 'percussion' || input.kind === 'cold' ? `${prefix}gasp` : `${prefix}wince_${this.voiceVariantIdx}`;
        vol = 0.25 + (lvl - 0.68) * 0.25;
        nextDelay = 2.4 + Math.random() * 0.8;
      } else {
        clipKey = `${prefix}sigh_mild`;
        vol = 0.16 + (lvl - 0.45) * 0.18;
        nextDelay = 3.0 + Math.random() * 0.9;
      }
      this.nextVoiceAt = timeSec + nextDelay;
      this.playVoiceClip(ctx, clipKey, vol, rateJitter);
      return;
    }

    if (lvl >= 0.92) {
      clipKey = `${prefix}groan_${this.voiceVariantIdx}`;
      vol = Math.min(0.38, 0.26 + (lvl - 0.9) * 0.28);
      nextDelay = 2.0 + Math.random() * 0.75;
    } else if (lvl >= 0.72) {
      clipKey = `${prefix}wince_${this.voiceVariantIdx}`;
      vol = 0.21 + (lvl - 0.72) * 0.28;
      nextDelay = 2.4 + Math.random() * 0.9;
    } else if (lvl >= 0.44) {
      clipKey = this.voiceVariantIdx === 0 ? `${prefix}sigh_mild` : `${prefix}breath_soft`;
      vol = 0.14 + (lvl - 0.44) * 0.18;
      nextDelay = 3.2 + Math.random() * 1.1;
    } else {
      clipKey = `${prefix}breath_soft`;
      vol = 0.08 + (lvl - 0.25) * 0.14;
      nextDelay = 4.6 + Math.random() * 1.5;
    }

    this.nextVoiceAt = timeSec + nextDelay;
    this.playVoiceClip(ctx, clipKey, vol, rateJitter);
  }

  private createDeviceHandle(ctx: AudioContext, item: ActiveDeviceAudioInput): DeviceAudioHandle | null {
    const now = ctx.currentTime;
    const sprite = item.sprite;
    const out = this.getMasterBus(ctx);
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.connect(out);

    const nodes: AudioNode[] = [masterGain];
    const handle: DeviceAudioHandle = {
      sprite,
      masterGain,
      nodes,
      nextPulseAt: now + 0.02,
      burstPhase: 0,
    };

    if (sprite === 'tens_unit') {
      const fanSrc = ctx.createBufferSource();
      fanSrc.buffer = this.getDeviceBuffer(ctx, 'fan_loop');
      fanSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(380, now);
      fanSrc.connect(lp);
      lp.connect(masterGain);
      fanSrc.start(now);
      nodes.push(fanSrc, lp);
      handle.src1 = fanSrc;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'shockwave_eswt') {
      const compSrc = ctx.createBufferSource();
      compSrc.buffer = this.getDeviceBuffer(ctx, 'eswt_comp_loop');
      compSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(360, now);
      compSrc.connect(lp);
      lp.connect(masterGain);
      compSrc.start(now);
      nodes.push(compSrc, lp);
      handle.src1 = compSrc;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'ultrasound_unit') {
      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, 'us_gel_loop');
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(720, now);
      src.connect(lp);
      lp.connect(masterGain);
      src.start(now);
      nodes.push(src, lp);
      handle.src1 = src;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'laser_hilt') {
      const fanSrc = ctx.createBufferSource();
      fanSrc.buffer = this.getDeviceBuffer(ctx, 'fan_loop');
      fanSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(520, now);
      bp.Q.setValueAtTime(0.75, now);

      const pulseOsc = ctx.createOscillator();
      pulseOsc.type = 'sine';
      pulseOsc.frequency.setValueAtTime(1520, now);
      const pulseGain = ctx.createGain();
      pulseGain.gain.setValueAtTime(0.0001, now);

      fanSrc.connect(bp);
      bp.connect(masterGain);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(out);

      fanSrc.start(now);
      pulseOsc.start(now);
      nodes.push(fanSrc, bp, pulseOsc, pulseGain);
      handle.src1 = fanSrc;
      handle.filter1 = bp;
      handle.pulseOsc = pulseOsc;
      handle.pulseGain = pulseGain;
      return handle;
    }

    if (sprite === 'swd_unit' || sprite === 'cryo_unit') {
      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, sprite === 'cryo_unit' ? 'cryo_pump_loop' : 'fan_loop');
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(sprite === 'cryo_unit' ? 680 : 480, now);
      src.connect(lp);
      lp.connect(masterGain);
      src.start(now);
      nodes.push(src, lp);
      handle.src1 = src;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'cpm_device') {
      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, 'cpm_motor_loop');
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(480, now);
      src.connect(lp);
      lp.connect(masterGain);
      src.start(now);
      nodes.push(src, lp);
      handle.src1 = src;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'infrared_lamp') {
      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, 'fan_loop');
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(220, now);
      src.connect(lp);
      lp.connect(masterGain);
      src.start(now);
      nodes.push(src, lp);
      handle.src1 = src;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'hydro_sink' || sprite === 'paraffin_bath') {
      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, sprite === 'hydro_sink' ? 'hydro_water_loop' : 'fan_loop');
      src.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(sprite === 'hydro_sink' ? 1850 : 320, now);
      src.connect(lp);
      lp.connect(masterGain);
      src.start(now);
      nodes.push(src, lp);
      handle.src1 = src;
      handle.filter1 = lp;
      return handle;
    }

    if (sprite === 'emg_biofeedback' || sprite === 'balance_trainer') {
      const pulseOsc = ctx.createOscillator();
      pulseOsc.type = 'sine';
      pulseOsc.frequency.setValueAtTime(sprite === 'balance_trainer' ? 740 : 620, now);
      const pulseGain = ctx.createGain();
      pulseGain.gain.setValueAtTime(0.0001, now);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(out);
      pulseOsc.start(now);
      nodes.push(pulseOsc, pulseGain);
      handle.pulseOsc = pulseOsc;
      handle.pulseGain = pulseGain;
      return handle;
    }

    if (sprite === 'magnetotherapy') {
      const humSrc = ctx.createBufferSource();
      humSrc.buffer = this.getDeviceBuffer(ctx, 'fan_loop');
      humSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(240, now);

      const coilOsc = ctx.createOscillator();
      coilOsc.type = 'sine';
      coilOsc.frequency.setValueAtTime(100, now);
      const coilGain = ctx.createGain();
      coilGain.gain.setValueAtTime(0.0001, now);

      humSrc.connect(lp);
      lp.connect(masterGain);
      coilOsc.connect(coilGain);
      coilGain.connect(out);

      humSrc.start(now);
      coilOsc.start(now);
      nodes.push(humSrc, lp, coilOsc, coilGain);
      handle.src1 = humSrc;
      handle.filter1 = lp;
      handle.pulseOsc = coilOsc;
      handle.pulseGain = coilGain;
      return handle;
    }

    if (sprite === 'tilt_table') {
      const motorSrc = ctx.createBufferSource();
      motorSrc.buffer = this.getDeviceBuffer(ctx, 'cpm_motor_loop');
      motorSrc.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, now);
      motorSrc.connect(lp);
      lp.connect(masterGain);
      motorSrc.start(now);
      nodes.push(motorSrc, lp);
      handle.src1 = motorSrc;
      handle.filter1 = lp;
      return handle;
    }

    masterGain.disconnect();
    return null;
  }

  private schedulePulse(ctx: AudioContext, h: DeviceAudioHandle, item: ActiveDeviceAudioInput, timeSec: number) {
    const now = ctx.currentTime;
    const p = item.deviceParams;
    const lookahead = now + 0.095;
    const out = this.getMasterBus(ctx);

    if (h.sprite === 'shockwave_eswt') {
      const hz = Math.max(1, Math.min(21, Number(p?.freqHz ?? 10)));
      const bar = Math.max(1, Math.min(5, Number(p?.intensity ?? 2.4)));
      const period = 1 / hz;
      if (h.nextPulseAt < now - 0.12) h.nextPulseAt = now + 0.01;

      const shotBuf = this.getDeviceBuffer(ctx, 'eswt_shot');
      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        const bar01 = (bar - 1) / 4;
        const src = ctx.createBufferSource();
        src.buffer = shotBuf;
        src.playbackRate.value = 0.94 + bar01 * 0.14;
        const g = ctx.createGain();
        g.gain.value = 0.15 + bar01 * 0.18;
        src.connect(g);
        g.connect(out);
        src.start(pt);
        h.nextPulseAt += period;
      }
    } else if (h.sprite === 'tens_unit') {
      const ma = Math.max(2, Math.min(60, Number(p?.intensity ?? 16)));
      const rawHz = Math.max(2, Math.min(150, Number(p?.freqHz ?? 80)));
      const mode = p?.mode ?? 'CONV';
      const contactMul = item.placedCount >= 2 ? 1.0 : item.placedCount === 1 ? 0.55 : 0.22;
      const ma01 = (ma - 2) / 58;

      const effHz = mode === 'BURST' ? 20 : mode === 'IFC' ? 22 : Math.min(24, rawHz);
      const period = 1 / effHz;
      if (h.nextPulseAt < now - 0.12) h.nextPulseAt = now + 0.01;

      const tickBuf = this.getDeviceBuffer(ctx, 'tens_tick');
      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        h.burstPhase += period;
        let gate = 1;
        if (mode === 'BURST') {
          const cycle = h.burstPhase % 0.5;
          gate = cycle < 0.22 ? 1 : 0;
        } else if (mode === 'IFC') {
          gate = 0.35 + 0.65 * Math.abs(Math.sin(h.burstPhase * Math.PI * 3.5));
        }
        if (gate > 0.05) {
          const src = ctx.createBufferSource();
          src.buffer = tickBuf;
          src.playbackRate.value = 0.92 + Math.min(0.28, rawHz / 450);
          const g = ctx.createGain();
          g.gain.value = (0.025 + ma01 * 0.082) * contactMul * gate;
          src.connect(g);
          g.connect(out);
          src.start(pt);
        }
        h.nextPulseAt += period;
      }
    } else if (h.sprite === 'laser_hilt' && h.pulseOsc && h.pulseGain) {
      const mode = p?.mode ?? 'ANALG';
      const period = mode === 'BIOSTIM' ? 1.35 : 0.85;
      if (h.nextPulseAt < now - 0.2) h.nextPulseAt = now + 0.05;
      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        const watts = Math.max(2, Math.min(15, Number(p?.intensity ?? 10)));
        const w01 = (watts - 2) / 13;
        h.pulseOsc.frequency.setValueAtTime(1440 + w01 * 160, pt);
        h.pulseGain.gain.setValueAtTime(0.0002, pt);
        h.pulseGain.gain.linearRampToValueAtTime(0.022 + w01 * 0.016, pt + 0.008);
        h.pulseGain.gain.exponentialRampToValueAtTime(0.0002, pt + 0.055);
        h.nextPulseAt += period;
      }
    } else if (h.sprite === 'emg_biofeedback' && h.pulseOsc && h.pulseGain) {
      const period = 0.25;
      if (h.nextPulseAt < now - 0.15) h.nextPulseAt = now + 0.03;
      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        const emgWave = 0.5 + 0.5 * Math.sin(timeSec * 1.4);
        const thr = Math.max(10, Math.min(100, Number(p?.intensity ?? 35)));
        const thr01 = thr / 100;
        if (item.placedCount > 0 && emgWave > thr01 * 0.85) {
          h.pulseOsc.frequency.setValueAtTime(560 + emgWave * 280, pt);
          h.pulseGain.gain.setValueAtTime(0.0002, pt);
          h.pulseGain.gain.linearRampToValueAtTime(0.04, pt + 0.015);
          h.pulseGain.gain.exponentialRampToValueAtTime(0.0002, pt + 0.12);
        }
        h.nextPulseAt += period;
      }
    } else if (h.sprite === 'balance_trainer' && h.pulseOsc && h.pulseGain) {
      const period = 1.6;
      if (h.nextPulseAt < now - 0.2) h.nextPulseAt = now + 0.1;
      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        h.pulseGain.gain.setValueAtTime(0.0002, pt);
        h.pulseGain.gain.linearRampToValueAtTime(0.036, pt + 0.012);
        h.pulseGain.gain.exponentialRampToValueAtTime(0.0002, pt + 0.14);
        h.nextPulseAt += period;
      }
    } else if (h.sprite === 'magnetotherapy' && h.pulseOsc && h.pulseGain) {
      const mT = Math.max(10, Math.min(100, Number(p?.intensity ?? 45)));
      const rawHz = Math.max(2, Math.min(100, Number(p?.freqHz ?? 25)));
      const mode = p?.mode ?? 'PULSED';
      const mT01 = (mT - 10) / 90;
      const effRate =
        mode === 'CONT'
          ? 4.0
          : mode === 'BURST'
            ? 9.0
            : Math.max(2.0, Math.min(13.0, rawHz * 0.22));
      const period = 1 / effRate;
      if (h.nextPulseAt < now - 0.14) h.nextPulseAt = now + 0.02;

      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        h.burstPhase += period;
        let gate = 1;
        if (mode === 'BURST') {
          const cycle = h.burstPhase % 0.85;
          gate = cycle < 0.36 ? 1 : 0.15;
        } else if (mode === 'CONT') {
          gate = 0.65;
        }
        const peakVol = (0.01 + mT01 * 0.026) * gate;
        h.pulseOsc.frequency.setValueAtTime(92 + mT01 * 28, pt);
        h.pulseGain.gain.setValueAtTime(0.0002, pt);
        h.pulseGain.gain.linearRampToValueAtTime(peakVol, pt + 0.014);
        h.pulseGain.gain.exponentialRampToValueAtTime(0.0003, pt + Math.min(0.085, period * 0.72));
        h.nextPulseAt += period;
      }
    }
  }

  private updateHandleParams(ctx: AudioContext, h: DeviceAudioHandle, item: ActiveDeviceAudioInput, timeSec: number) {
    const now = ctx.currentTime;
    const p = item.deviceParams;

    if (h.sprite === 'tens_unit') {
      const ma = Math.max(2, Math.min(60, Number(p?.intensity ?? 16)));
      const ma01 = (ma - 2) / 58;
      h.masterGain.gain.setTargetAtTime(0.008 + ma01 * 0.012, now, 0.05);
    } else if (h.sprite === 'shockwave_eswt') {
      const bar = Math.max(1, Math.min(5, Number(p?.intensity ?? 2.4)));
      const bar01 = (bar - 1) / 4;
      h.masterGain.gain.setTargetAtTime(0.048 + bar01 * 0.048, now, 0.05);
      h.src1?.playbackRate.setTargetAtTime(0.92 + bar01 * 0.18, now, 0.05);
    } else if (h.sprite === 'ultrasound_unit') {
      const w = Math.max(0.2, Math.min(2.5, Number(p?.intensity ?? 1.2)));
      const w01 = (w - 0.2) / 2.3;
      const duty = Number(p?.dutyPct ?? 50);
      let dutyGate = 1;
      if (duty < 95) {
        const phase = (timeSec * 3.5) % 1;
        dutyGate = phase < duty / 100 ? 1.0 : 0.3;
      }
      const contactMul = item.placedCount > 0 ? 1.0 : 0.45;
      h.masterGain.gain.setTargetAtTime((0.036 + w01 * 0.044) * dutyGate * contactMul, now, 0.04);
      h.src1?.playbackRate.setTargetAtTime(Number(p?.freqHz ?? 1) > 2 ? 1.12 : 0.96, now, 0.05);
    } else if (h.sprite === 'laser_hilt') {
      const watts = Math.max(2, Math.min(15, Number(p?.intensity ?? 10)));
      const w01 = (watts - 2) / 13;
      h.masterGain.gain.setTargetAtTime(0.034 + w01 * 0.028, now, 0.05);
    } else if (h.sprite === 'swd_unit') {
      const watts = Math.max(20, Math.min(250, Number(p?.intensity ?? 120)));
      const w01 = (watts - 20) / 230;
      const isPulsed = p?.mode === 'PULSED';
      const pulseGate = isPulsed ? (Math.sin(timeSec * Math.PI * 8) > 0 ? 1.0 : 0.45) : 1.0;
      h.masterGain.gain.setTargetAtTime((0.038 + w01 * 0.044) * pulseGate, now, 0.04);
    } else if (h.sprite === 'cryo_unit') {
      const mmHg = Math.max(20, Math.min(75, Number(p?.pressureMmHg ?? 45)));
      const mm01 = (mmHg - 20) / 55;
      const flowMul = p?.flow === 'HIGH' ? 1.15 : p?.flow === 'LOW' ? 0.74 : 0.94;
      h.masterGain.gain.setTargetAtTime((0.048 + mm01 * 0.05) * flowMul, now, 0.05);
      h.src1?.playbackRate.setTargetAtTime(0.9 + mm01 * 0.18, now, 0.05);
    } else if (h.sprite === 'cpm_device') {
      const speed = Math.max(1, Math.min(4, Number(p?.speed ?? 2)));
      const cycleRate = 0.65 + speed * 0.35;
      const strokeVel = Math.abs(Math.sin(timeSec * cycleRate));
      h.masterGain.gain.setTargetAtTime(0.042 + speed * 0.012 + strokeVel * 0.022, now, 0.04);
      h.src1?.playbackRate.setTargetAtTime(0.86 + speed * 0.06 + strokeVel * 0.14, now, 0.04);
    } else if (h.sprite === 'infrared_lamp') {
      const ir = Math.max(0.1, Math.min(1, item.irIntensity ?? 0.85));
      h.masterGain.gain.setTargetAtTime(0.012 + ir * 0.015, now, 0.05);
    } else if (h.sprite === 'hydro_sink' || h.sprite === 'paraffin_bath') {
      const temp = Number(p?.tempC ?? (h.sprite === 'hydro_sink' ? 74 : 53));
      const t01 = h.sprite === 'hydro_sink' ? (temp - 65) / 15 : (temp - 48) / 10;
      h.masterGain.gain.setTargetAtTime(
        (h.sprite === 'hydro_sink' ? 0.072 : 0.03) + Math.max(0, Math.min(1, t01)) * 0.04,
        now,
        0.05
      );
    } else if (h.sprite === 'emg_biofeedback' || h.sprite === 'balance_trainer') {
      h.masterGain.gain.setTargetAtTime(0.008, now, 0.05);
    } else if (h.sprite === 'magnetotherapy') {
      const mT = Math.max(10, Math.min(100, Number(p?.intensity ?? 45)));
      const mT01 = (mT - 10) / 90;
      const zone = p?.magnetZone ?? 'SCAN';
      const speed = Math.max(1, Math.min(3, Number(p?.speed ?? 2)));
      const scanGlide = zone === 'SCAN' ? 0.005 + speed * 0.002 : 0;
      h.masterGain.gain.setTargetAtTime(0.012 + mT01 * 0.014 + scanGlide, now, 0.06);
      h.filter1?.frequency.setTargetAtTime(210 + mT01 * 110 + (zone === 'SCAN' ? 40 : 0), now, 0.08);
    } else if (h.sprite === 'tilt_table') {
      const spd = Math.max(1, Math.min(3, Number(p?.speed ?? 2)));
      const motorActive = Boolean(item.isMoving);
      h.masterGain.gain.setTargetAtTime(motorActive ? 0.028 + spd * 0.011 : 0.0002, now, 0.05);
      h.src1?.playbackRate.setTargetAtTime(0.76 + spd * 0.11, now, 0.05);
    }

    this.schedulePulse(ctx, h, item, timeSec);
  }

  private disposeNodeList(ctx: AudioContext | null, masterGain: GainNode, nodes: AudioNode[]) {
    if (ctx) {
      const now = ctx.currentTime;
      try {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setTargetAtTime(0.0001, now, 0.02);
      } catch {
        // Ignore
      }
      window.setTimeout(() => {
        for (const n of nodes) {
          try {
            if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
              (n as OscillatorNode).stop();
            }
          } catch {
            // Ignore
          }
          try {
            n.disconnect();
          } catch {
            // Ignore
          }
        }
      }, 90);
    } else {
      for (const n of nodes) {
        try {
          n.disconnect();
        } catch {
          // Ignore
        }
      }
    }
  }

  private disposeHandle(ctx: AudioContext | null, h: DeviceAudioHandle) {
    this.disposeNodeList(ctx, h.masterGain, h.nodes);
  }

  syncFppDevices(devices: ActiveDeviceAudioInput[], timeSec: number) {
    if (!this.enabled) {
      if (this.activeDevices.size > 0) this.stopAllDevices();
      return;
    }
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      return;
    }
    if (devices.length === 0 && this.activeDevices.size === 0) {
      return;
    }

    if (timeSec - this.lastDeviceSyncAt < 0.032 && devices.length === this.activeDevices.size) {
      return;
    }
    this.lastDeviceSyncAt = timeSec;

    const seenIds = new Set<string>();
    for (let i = 0; i < devices.length; i++) {
      const dev = devices[i];
      if (!dev.isRunning) continue;
      seenIds.add(dev.instanceId);
      let h = this.activeDevices.get(dev.instanceId);
      if (!h || h.sprite !== dev.sprite) {
        if (h) {
          this.disposeHandle(ctx, h);
          this.activeDevices.delete(dev.instanceId);
        }
        const created = this.createDeviceHandle(ctx, dev);
        if (created) {
          this.activeDevices.set(dev.instanceId, created);
          h = created;
        }
      }
      if (h) {
        this.updateHandleParams(ctx, h, dev, timeSec);
      }
    }

    for (const [id, h] of this.activeDevices.entries()) {
      if (!seenIds.has(id)) {
        this.disposeHandle(ctx, h);
        this.activeDevices.delete(id);
      }
    }
  }

  stopAllDevices() {
    for (const h of this.activeDevices.values()) {
      this.disposeHandle(this.ctx, h);
    }
    this.activeDevices.clear();
    if (this.activeVoice && this.ctx) {
      const now = this.ctx.currentTime;
      try {
        this.activeVoice.gain.gain.setTargetAtTime(0.0001, now, 0.025);
        this.activeVoice.src.stop(now + 0.07);
      } catch {
        // Ignore
      }
      this.activeVoice = null;
    }
    this.disposeEquipMove(this.ctx);
    this.lastDeviceSyncAt = -1;
    this.lastVoiceSyncAt = -1;
    this.lastMoveSyncAt = -1;
    this.nextVoiceAt = 0;
    this.lastVoiceSpikeAt = -1;
    if (!this.enabled) {
      this.clearCaches();
    }
  }

  warmup() {
    this.getCtx();
  }
}

export const soundFx = new SoundEngine();

if (typeof window !== 'undefined') {
  const unlock = () => {
    soundFx.warmup();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true, once: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true, once: true });
}
