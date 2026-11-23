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
  isScream: boolean;
}

const VOICE_SR = 28000;
const SFX_SR = 32000;

interface VoiceSynthSpec {
  dur: number;
  f0Start: number;
  f0Peak: number;
  f0End: number;
  peakAt?: number;
  doubleCry?: boolean;
  f1Start: number;
  f1End: number;
  f2Start: number;
  f2End: number;
  f3: number;
  f4: number;
  bw1: number;
  bw2: number;
  bw3: number;
  voiceMix: number;
  breathMix: number;
  strain: number; // 0 = relaxed breath/sigh, 0.5 = sharp pain wince, 0.95 = full pressed overdose scream
  attackSec: number;
  isInhale?: boolean;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterBus: GainNode | null = null;
  private voiceBus: GainNode | null = null;
  private deviceBus: GainNode | null = null;
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
  private voiceDuckUntil = 0;
  private voiceVariantIdx = 0;
  private screamVariantIdx = 0;
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

  private ensureBuses(ctx: AudioContext) {
    if (this.masterBus && this.masterBus.context === ctx && this.voiceBus && this.deviceBus) {
      return;
    }

    // Main clinic master bus: warm small room + clean presence + transparent safety limiter
    const masterIn = ctx.createGain();
    masterIn.gain.value = 1.0;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0;

    // Subtle natural clinic room early reflections (0.18s damped air)
    const irLen = Math.floor(ctx.sampleRate * 0.18);
    const irBuf = ctx.createBuffer(1, irLen, ctx.sampleRate);
    const irData = irBuf.getChannelData(0);
    let irLp = 0;
    for (let i = 0; i < irLen; i++) {
      const t = i / ctx.sampleRate;
      const env = Math.exp(-t / 0.052);
      const early = i === 140 || i === 330 || i === 610 ? 0.28 : 0;
      const raw = (Math.random() * 2 - 1) * env * 0.22 + early;
      irLp = irLp + 0.26 * (raw - irLp);
      irData[i] = irLp;
    }
    const roomConv = ctx.createConvolver();
    roomConv.buffer = irBuf;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.09;

    const warmLp = ctx.createBiquadFilter();
    warmLp.type = 'lowpass';
    warmLp.frequency.value = 13500;
    warmLp.Q.value = 0.55;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8;
    comp.knee.value = 8;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.002;
    comp.release.value = 0.12;

    const outGain = ctx.createGain();
    outGain.gain.value = 1.38;

    masterIn.connect(dryGain);
    masterIn.connect(roomConv);
    roomConv.connect(wetGain);
    dryGain.connect(warmLp);
    wetGain.connect(warmLp);
    warmLp.connect(comp);
    comp.connect(outGain);
    outGain.connect(ctx.destination);

    // Dedicated Device Sub-bus (ducks cleanly when the patient screams or cries out)
    const devBus = ctx.createGain();
    devBus.gain.value = 1.0;
    devBus.connect(masterIn);

    // Dedicated Vocal Bus (clean chest warmth + crystal vocal presence at 2.4kHz, zero mud)
    const vBus = ctx.createGain();
    vBus.gain.value = 1.15;

    const vHp = ctx.createBiquadFilter();
    vHp.type = 'highpass';
    vHp.frequency.value = 90;
    vHp.Q.value = 0.7;

    const vBody = ctx.createBiquadFilter();
    vBody.type = 'peaking';
    vBody.frequency.value = 240;
    vBody.Q.value = 0.9;
    vBody.gain.value = 2.4;

    const vPresence = ctx.createBiquadFilter();
    vPresence.type = 'peaking';
    vPresence.frequency.value = 2450;
    vPresence.Q.value = 0.75;
    vPresence.gain.value = 4.2;

    const vRoomWet = ctx.createGain();
    vRoomWet.gain.value = 0.16;

    vBus.connect(vHp);
    vHp.connect(vBody);
    vBody.connect(vPresence);
    vPresence.connect(masterIn);
    vPresence.connect(vRoomWet);
    vRoomWet.connect(roomConv);

    this.masterBus = masterIn;
    this.deviceBus = devBus;
    this.voiceBus = vBus;
  }

  private getMasterBus(ctx: AudioContext): AudioNode {
    this.ensureBuses(ctx);
    return this.masterBus!;
  }

  private getDeviceBus(ctx: AudioContext): AudioNode {
    this.ensureBuses(ctx);
    return this.deviceBus!;
  }

  private getVoiceBus(ctx: AudioContext): AudioNode {
    this.ensureBuses(ctx);
    return this.voiceBus!;
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
   * 2-pole formant resonator helper (normalized gain so resonances stay smooth & realistic).
   */
  private applyFormantCascade(
    x: number,
    f: number,
    bw: number,
    sr: number,
    state: [number, number]
  ): number {
    const clampedF = Math.max(90, Math.min(sr * 0.44, f));
    const r = Math.exp((-Math.PI * bw) / sr);
    const c = -(r * r);
    const k = 2 * r * Math.cos((2 * Math.PI * clampedF) / sr);
    const a0 = 1 - k - c;
    const y = a0 * x + k * state[0] + c * state[1];
    state[1] = state[0];
    state[0] = y;
    return y;
  }

  /**
   * Rosenberg glottal derivative pulse + vocal-tract 4-formant Klatt-style cascade synthesizer.
   * Produces rich, natural, loud chest voice, winces, groans, and full distress screams
   * instead of muffled noise static.
   */
  private buildHumanVoiceBuffer(ctx: AudioContext, spec: VoiceSynthSpec): AudioBuffer {
    const sr = VOICE_SR;
    const n = Math.floor(sr * spec.dur);
    const raw = new Float32Array(n);

    let phase = 0;
    let cycleIdx = 0;
    let jitter = 1;
    let shimmer = 1;
    let prevGlotFlow = 0;
    let subPhase = 0;

    let b0 = 0, b1 = 0, b2 = 0;
    const st1: [number, number] = [0, 0];
    const st2: [number, number] = [0, 0];
    const st3: [number, number] = [0, 0];
    const st4: [number, number] = [0, 0];
    const stBypass1: [number, number] = [0, 0];
    const stBypass2: [number, number] = [0, 0];
    let dcX = 0, dcY = 0;
    let prevOut = 0;

    const peakAt = spec.peakAt ?? 0.24;
    const strain = spec.strain;
    // Rosenberg glottal open/close ratios: higher strain = sharper closing snap -> loud bright upper harmonics
    const tp = 0.46 - strain * 0.08;
    const tn = 0.20 - strain * 0.095;

    for (let i = 0; i < n; i++) {
      const tSec = i / sr;
      const u = i / n;

      // Pitch contour (supports single urgent arc OR double pain cry "اخ آاااه!")
      let f0Base: number;
      if (spec.doubleCry) {
        if (u < 0.26) {
          const w = u / 0.26;
          f0Base = spec.f0Start + (spec.f0Peak * 0.86 - spec.f0Start) * Math.sin(w * Math.PI * 0.5);
        } else if (u < 0.36) {
          const w = (u - 0.26) / 0.10;
          f0Base = spec.f0Peak * 0.86 - (spec.f0Peak * 0.14) * w;
        } else if (u < 0.54) {
          const w = (u - 0.36) / 0.18;
          f0Base = spec.f0Peak * 0.72 + (spec.f0Peak - spec.f0Peak * 0.72) * Math.sin(w * Math.PI * 0.5);
        } else {
          const w = (u - 0.54) / 0.46;
          f0Base = spec.f0Peak + (spec.f0End - spec.f0Peak) * Math.pow(w, 0.82);
        }
      } else if (u < peakAt) {
        f0Base = spec.f0Start + (spec.f0Peak - spec.f0Start) * Math.sin((u / peakAt) * Math.PI * 0.5);
      } else {
        f0Base = spec.f0Peak + (spec.f0End - spec.f0Peak) * Math.pow((u - peakAt) / (1 - peakAt), 0.76);
      }

      // Natural human vibrato + distress vocal tremor (fast nervous quiver when screaming)
      const vibrato = 1 + (0.011 + strain * 0.018) * Math.sin(2 * Math.PI * (5.2 + strain * 3.1) * tSec);
      const distressQuiver = strain > 0.5 ? 1 + strain * 0.025 * Math.sin(2 * Math.PI * 23 * tSec) : 1;
      const f0 = f0Base * vibrato * distressQuiver * jitter;

      phase += f0 / sr;
      subPhase += (f0 * 0.5) / sr;
      if (phase >= 1) {
        phase -= 1;
        cycleIdx += 1;
        const jitAmt = 0.012 + strain * 0.036;
        const shimAmt = 0.05 + strain * 0.16;
        jitter = 1 + (Math.random() * 2 - 1) * jitAmt;
        // Pressed pain voice exhibits slight odd/even cycle diplophonia (authentic vocal cord strain!)
        const dip = strain > 0.65 && cycleIdx % 2 === 1 ? 1 - (strain - 0.6) * 0.24 : 1;
        shimmer = dip * (1 + (Math.random() * 2 - 1) * shimAmt);
      }
      if (subPhase >= 1) subPhase -= 1;

      // Rosenberg glottal pulse flow -> lip-radiated derivative
      let glot = 0;
      if (spec.voiceMix > 0.01) {
        let glotFlow = 0;
        if (phase < tp) {
          const w = phase / tp;
          glotFlow = 0.5 * (1 - Math.cos(Math.PI * w));
        } else if (phase < tp + tn) {
          const w = (phase - tp) / tn;
          glotFlow = Math.cos(Math.PI * 0.5 * w);
        }
        // Derivative produces natural acoustic excitation with smooth -12dB/oct tilt + pressing brightness
        const glotDeriv = (glotFlow - prevGlotFlow) * (sr / 4800);
        prevGlotFlow = glotFlow;
        // Blend direct chest fundamental warmth with crisp glottal closure impulse + subtle subharmonic grit
        const chestFund = Math.sin(2 * Math.PI * phase) * (0.42 - strain * 0.12);
        const subGrit = strain > 0.62 ? Math.sin(2 * Math.PI * subPhase) * (strain - 0.62) * 0.35 : 0;
        glot = (glotDeriv * (0.78 + strain * 0.55) + chestFund + subGrit) * shimmer;
      }

      // Turbulent glottal/pharyngeal air noise (pink-tilted, modulated by open glottis)
      const w = Math.random() * 2 - 1;
      b0 = 0.992 * b0 + w * 0.05;
      b1 = 0.94 * b1 + w * 0.11;
      b2 = 0.72 * b2 + w * 0.22;
      const aspNoise = b0 * 0.35 + b1 * 0.55 + b2 * 0.42;
      const openGate = phase < tp + tn ? 1.0 : 0.28;
      const screamFriction = strain > 0.6 ? aspNoise * strain * 0.65 : 0;

      const source =
        glot * spec.voiceMix +
        aspNoise * spec.breathMix * openGate * 0.78 +
        screamFriction * openGate;

      // Formant trajectory over utterance
      const f1 = spec.f1Start + (spec.f1End - spec.f1Start) * u;
      const f2 = spec.f2Start + (spec.f2End - spec.f2Start) * u;

      // 4-formant Klatt cascade for genuine human vocal tract acoustics
      const c1 = this.applyFormantCascade(source, f1, spec.bw1, sr, st1);
      const c2 = this.applyFormantCascade(c1, f2, spec.bw2, sr, st2);
      const c3 = this.applyFormantCascade(c2, spec.f3, spec.bw3, sr, st3);
      const c4 = this.applyFormantCascade(c3, spec.f4, 240, sr, st4);

      // Parallel chest/mouth reinforcement so F1+F2 carry full organic weight (no thin/hollow sound!)
      const p1 = this.applyFormantCascade(source, f1, spec.bw1 * 1.15, sr, stBypass1) * 0.55;
      const p2 = this.applyFormantCascade(source, f2, spec.bw2 * 1.2, sr, stBypass2) * 0.36;
      const vocalSignal = c4 * 0.68 + p1 + p2;

      // Gentle lip-radiation tilt removal + DC blocker
      const dcOut = vocalSignal - dcX + 0.995 * dcY;
      dcX = vocalSignal;
      dcY = dcOut;
      const brightWarm = dcOut * 0.86 + (dcOut - prevOut) * 0.14;
      prevOut = dcOut;

      // Dynamic human amplitude envelope
      const att = Math.pow(Math.min(1, tSec / spec.attackSec), 1.15);
      let bodyEnv: number;
      if (spec.isInhale) {
        bodyEnv = Math.sin(Math.pow(u, 0.68) * Math.PI);
      } else if (spec.doubleCry) {
        // Sharp first exclamation ("آخ") -> brief catch -> explosive sustained scream ("آاااااه!")
        const dip = u > 0.25 && u < 0.39 ? 0.28 + 0.72 * Math.abs((u - 0.32) / 0.07) : 1.0;
        const sustain = u < 0.72 ? 1.0 : Math.pow(Math.max(0, (1 - u) / 0.28), 0.75);
        bodyEnv = dip * sustain;
      } else if (strain > 0.75) {
        // Loud sustained scream holds near full intensity then drops rapidly as breath empties
        bodyEnv = u < 0.7 ? 1.0 - u * 0.12 : Math.pow(Math.max(0, (1 - u) / 0.3), 0.72);
      } else {
        bodyEnv = Math.pow(Math.max(0, 1 - u * 0.92), 0.68);
      }

      const tailFade = u > 0.9 ? Math.max(0, (1 - u) / 0.1) : 1;
      raw[i] = brightWarm * att * bodyEnv * tailFade;
    }

    // RMS-aware loudness normalization with natural vocal saturation so voice is loud, clear, and warm
    let maxAbs = 0.0001;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const v = raw[i];
      const a = Math.abs(v);
      if (a > maxAbs) maxAbs = a;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, n));
    const targetRms = 0.22 + strain * 0.18;
    const gainNorm = Math.min(0.95 / maxAbs, targetRms / Math.max(0.0001, rms));

    const buf = ctx.createBuffer(1, n, sr);
    const ch = buf.getChannelData(0);
    const drive = 1.08 + strain * 0.38;
    for (let i = 0; i < n; i++) {
      ch[i] = Math.tanh(raw[i] * gainNorm * drive) * 0.94;
    }
    return buf;
  }

  private getVoiceBuffer(ctx: AudioContext, key: string): AudioBuffer {
    const cached = this.bufferCache.get(key);
    if (cached && cached.sampleRate === VOICE_SR) return cached;

    let spec: VoiceSynthSpec;
    switch (key) {
      // ===== MALE PATIENT VOICES =====
      case 'm_breath_soft':
        spec = {
          dur: 0.48, f0Start: 112, f0Peak: 116, f0End: 94,
          f1Start: 460, f1End: 390, f2Start: 1020, f2End: 880, f3: 2450, f4: 3400,
          bw1: 110, bw2: 145, bw3: 185, voiceMix: 0.36, breathMix: 0.48, strain: 0.08, attackSec: 0.08,
        };
        break;
      case 'm_sigh_mild':
        spec = {
          dur: 0.50, f0Start: 120, f0Peak: 132, f0End: 98,
          f1Start: 540, f1End: 430, f2Start: 1060, f2End: 900, f3: 2500, f4: 3450,
          bw1: 82, bw2: 112, bw3: 155, voiceMix: 0.72, breathMix: 0.28, strain: 0.22, attackSec: 0.055,
        };
        break;
      case 'm_wince_0':
        spec = {
          dur: 0.42, f0Start: 144, f0Peak: 196, f0End: 122, peakAt: 0.22,
          f1Start: 740, f1End: 590, f2Start: 1260, f2End: 1090, f3: 2620, f4: 3520,
          bw1: 72, bw2: 96, bw3: 140, voiceMix: 0.88, breathMix: 0.22, strain: 0.50, attackSec: 0.022,
        };
        break;
      case 'm_wince_1':
        spec = {
          dur: 0.46, f0Start: 136, f0Peak: 184, f0End: 116, peakAt: 0.25,
          f1Start: 690, f1End: 540, f2Start: 1200, f2End: 1040, f3: 2580, f4: 3480,
          bw1: 74, bw2: 100, bw3: 145, voiceMix: 0.86, breathMix: 0.24, strain: 0.46, attackSec: 0.026,
        };
        break;
      case 'm_groan_0':
        spec = {
          dur: 0.58, f0Start: 158, f0Peak: 224, f0End: 134, peakAt: 0.28,
          f1Start: 780, f1End: 650, f2Start: 1280, f2End: 1120, f3: 2700, f4: 3600,
          bw1: 68, bw2: 90, bw3: 130, voiceMix: 0.94, breathMix: 0.18, strain: 0.72, attackSec: 0.022,
        };
        break;
      case 'm_groan_1':
        spec = {
          dur: 0.52, f0Start: 150, f0Peak: 210, f0End: 128, peakAt: 0.24,
          f1Start: 740, f1End: 610, f2Start: 1230, f2End: 1070, f3: 2660, f4: 3560,
          bw1: 70, bw2: 94, bw3: 135, voiceMix: 0.92, breathMix: 0.20, strain: 0.68, attackSec: 0.02,
        };
        break;
      case 'm_scream_0':
        // Full loud overdose distress scream ("آاااااااااه!")
        spec = {
          dur: 0.82, f0Start: 188, f0Peak: 318, f0End: 220, peakAt: 0.24,
          f1Start: 880, f1End: 790, f2Start: 1460, f2End: 1310, f3: 2860, f4: 3740,
          bw1: 65, bw2: 86, bw3: 125, voiceMix: 0.98, breathMix: 0.22, strain: 0.92, attackSec: 0.016,
        };
        break;
      case 'm_scream_1':
        // Double pain cry ("آخ! آااااااه!")
        spec = {
          dur: 0.76, f0Start: 196, f0Peak: 338, f0End: 230, doubleCry: true,
          f1Start: 860, f1End: 770, f2Start: 1480, f2End: 1330, f3: 2900, f4: 3780,
          bw1: 66, bw2: 88, bw3: 128, voiceMix: 0.98, breathMix: 0.22, strain: 0.94, attackSec: 0.014,
        };
        break;
      case 'm_scream_sharp':
        // Acute shock scream ("آاااااخ!") when device jumps straight into overdose
        spec = {
          dur: 0.48, f0Start: 215, f0Peak: 345, f0End: 195, peakAt: 0.18,
          f1Start: 900, f1End: 760, f2Start: 1520, f2End: 1280, f3: 2920, f4: 3800,
          bw1: 64, bw2: 86, bw3: 124, voiceMix: 0.98, breathMix: 0.24, strain: 0.95, attackSec: 0.011,
        };
        break;
      case 'm_gasp':
        spec = {
          dur: 0.28, f0Start: 168, f0Peak: 224, f0End: 146, peakAt: 0.38,
          f1Start: 620, f1End: 740, f2Start: 1220, f2End: 1380, f3: 2660, f4: 3520,
          bw1: 88, bw2: 115, bw3: 160, voiceMix: 0.62, breathMix: 0.58, strain: 0.52, attackSec: 0.015, isInhale: true,
        };
        break;

      // ===== FEMALE PATIENT VOICES =====
      case 'f_breath_soft':
        spec = {
          dur: 0.46, f0Start: 204, f0Peak: 212, f0End: 176,
          f1Start: 510, f1End: 440, f2Start: 1180, f2End: 1020, f3: 2740, f4: 3800,
          bw1: 115, bw2: 150, bw3: 190, voiceMix: 0.34, breathMix: 0.48, strain: 0.08, attackSec: 0.075,
        };
        break;
      case 'f_sigh_mild':
        spec = {
          dur: 0.48, f0Start: 214, f0Peak: 234, f0End: 180,
          f1Start: 600, f1End: 480, f2Start: 1220, f2End: 1040, f3: 2780, f4: 3850,
          bw1: 84, bw2: 114, bw3: 160, voiceMix: 0.70, breathMix: 0.28, strain: 0.22, attackSec: 0.05,
        };
        break;
      case 'f_wince_0':
        spec = {
          dur: 0.40, f0Start: 248, f0Peak: 332, f0End: 218, peakAt: 0.22,
          f1Start: 800, f1End: 650, f2Start: 1420, f2End: 1220, f3: 2880, f4: 3920,
          bw1: 74, bw2: 100, bw3: 145, voiceMix: 0.88, breathMix: 0.22, strain: 0.50, attackSec: 0.02,
        };
        break;
      case 'f_wince_1':
        spec = {
          dur: 0.44, f0Start: 238, f0Peak: 316, f0End: 208, peakAt: 0.24,
          f1Start: 750, f1End: 610, f2Start: 1360, f2End: 1180, f3: 2840, f4: 3880,
          bw1: 76, bw2: 104, bw3: 150, voiceMix: 0.86, breathMix: 0.24, strain: 0.46, attackSec: 0.024,
        };
        break;
      case 'f_groan_0':
        spec = {
          dur: 0.55, f0Start: 270, f0Peak: 378, f0End: 236, peakAt: 0.26,
          f1Start: 840, f1End: 710, f2Start: 1460, f2End: 1280, f3: 2940, f4: 3980,
          bw1: 70, bw2: 94, bw3: 135, voiceMix: 0.94, breathMix: 0.18, strain: 0.72, attackSec: 0.02,
        };
        break;
      case 'f_groan_1':
        spec = {
          dur: 0.50, f0Start: 258, f0Peak: 356, f0End: 226, peakAt: 0.23,
          f1Start: 800, f1End: 670, f2Start: 1400, f2End: 1230, f3: 2900, f4: 3940,
          bw1: 72, bw2: 98, bw3: 140, voiceMix: 0.92, breathMix: 0.20, strain: 0.68, attackSec: 0.018,
        };
        break;
      case 'f_scream_0':
        spec = {
          dur: 0.80, f0Start: 325, f0Peak: 545, f0End: 380, peakAt: 0.24,
          f1Start: 940, f1End: 850, f2Start: 1620, f2End: 1440, f3: 3080, f4: 4100,
          bw1: 68, bw2: 90, bw3: 130, voiceMix: 0.98, breathMix: 0.22, strain: 0.92, attackSec: 0.014,
        };
        break;
      case 'f_scream_1':
        spec = {
          dur: 0.74, f0Start: 345, f0Peak: 575, f0End: 395, doubleCry: true,
          f1Start: 920, f1End: 830, f2Start: 1640, f2End: 1460, f3: 3120, f4: 4140,
          bw1: 68, bw2: 92, bw3: 132, voiceMix: 0.98, breathMix: 0.22, strain: 0.94, attackSec: 0.012,
        };
        break;
      case 'f_scream_sharp':
        spec = {
          dur: 0.46, f0Start: 365, f0Peak: 590, f0End: 340, peakAt: 0.17,
          f1Start: 960, f1End: 820, f2Start: 1680, f2End: 1420, f3: 3150, f4: 4160,
          bw1: 66, bw2: 90, bw3: 128, voiceMix: 0.98, breathMix: 0.24, strain: 0.95, attackSec: 0.010,
        };
        break;
      case 'f_gasp':
      default:
        spec = {
          dur: 0.26, f0Start: 280, f0Peak: 370, f0End: 245, peakAt: 0.36,
          f1Start: 690, f1End: 820, f2Start: 1380, f2End: 1540, f3: 2920, f4: 3940,
          bw1: 90, bw2: 120, bw3: 165, voiceMix: 0.60, breathMix: 0.56, strain: 0.52, attackSec: 0.014, isInhale: true,
        };
        break;
    }

    const buf = this.buildHumanVoiceBuffer(ctx, spec);
    this.bufferCache.set(key, buf);
    return buf;
  }

  /**
   * Warm acoustic chimes / crisp medical hardware SFX & seamless loops (zero harsh raw synth beeps).
   */
  private getDeviceBuffer(ctx: AudioContext, key: string): AudioBuffer {
    const cached = this.bufferCache.get(key);
    if (cached && cached.sampleRate === SFX_SR) return cached;

    const sr = SFX_SR;
    let buf: AudioBuffer;

    if (key === 'ui_tap') {
      // Soft wooden/ceramic UI micro-tap
      const n = Math.floor(sr * 0.022);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const body = Math.sin(2 * Math.PI * (640 - t * 6500) * t) * Math.exp(-t / 0.0028);
        const air = (Math.random() * 2 - 1) * Math.exp(-t / 0.0012) * 0.22;
        ch[i] = Math.tanh((body * 0.72 + air) * 1.15) * 0.8;
      }
    } else if (key === 'tens_tick') {
      // Crisp biomedical neuromuscular pulse tap (tight warm thump + soft electrode snap)
      const n = Math.floor(sr * 0.018);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = (Math.random() * 2 - 1) * Math.exp(-t / 0.0009);
        lp = lp + 0.45 * (w - lp);
        const thump = Math.sin(2 * Math.PI * (145 - t * 1800) * t) * Math.exp(-t / 0.0042) * 0.65;
        const snap = Math.sin(2 * Math.PI * 1450 * t) * Math.exp(-t / 0.0012) * 0.22;
        ch[i] = Math.tanh((lp * 0.55 + thump + snap) * 1.15) * 0.85;
      }
    } else if (key === 'eswt_shot') {
      // Authentic radial shockwave ballistic projectile strike ("تَكْ!") + tight air exhaust
      const n = Math.floor(sr * 0.085);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let airLp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const striker =
          (Math.sin(2 * Math.PI * 690 * t) * 0.42 +
            Math.sin(2 * Math.PI * 1240 * t) * 0.32 +
            Math.sin(2 * Math.PI * 1980 * t) * 0.16) *
          Math.exp(-t / 0.0022);
        const tissueThud =
          Math.sin(2 * Math.PI * (138 * Math.exp(-t * 28) + 64) * t) *
          Math.exp(-t / 0.014) *
          0.74;
        const w = Math.random() * 2 - 1;
        airLp = airLp + 0.28 * (w - airLp);
        const puff = (w - airLp) * Math.exp(-t / 0.008) * 0.34;
        ch[i] = Math.tanh((striker * 0.88 + tissueThud + puff) * 1.18) * 0.88;
      }
    } else if (key === 'pad_stick') {
      // Hydrogel electrode pad suction press on skin
      const n = Math.floor(sr * 0.072);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const env = Math.sin(Math.min(1, t / 0.012) * Math.PI * 0.5) * Math.exp(-t / 0.019);
        const pop = Math.sin(2 * Math.PI * (190 - t * 1250) * t) * env * 0.72;
        lp = lp + 0.28 * ((Math.random() * 2 - 1) - lp);
        const tack = lp * Math.exp(-t / 0.01) * 0.42;
        ch[i] = Math.tanh((pop + tack) * 1.18) * 0.85;
      }
    } else if (key === 'switch_click') {
      // Crisp physical console tactile rocker micro-click
      const n = Math.floor(sr * 0.020);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const hit =
          (Math.sin(2 * Math.PI * 1080 * t) * 0.45 +
            Math.sin(2 * Math.PI * 2250 * t) * 0.28 +
            Math.sin(2 * Math.PI * 210 * t) * 0.35) *
          Math.exp(-t / 0.0018);
        ch[i] = Math.tanh(hit * 1.18) * 0.82;
      }
    } else if (key === 'equip_thud') {
      // Heavy damped rubber-caster / metal chassis set-down thud
      const n = Math.floor(sr * 0.105);
      buf = ctx.createBuffer(1, n, sr);
      const ch = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const thud = Math.sin(2 * Math.PI * (102 * Math.exp(-t * 16) + 48) * t) * Math.exp(-t / 0.026) * 0.84;
        const chassis = Math.sin(2 * Math.PI * 310 * t) * Math.exp(-t / 0.009) * 0.18;
        lp = lp + 0.22 * ((Math.random() * 2 - 1) - lp);
        ch[i] = Math.tanh((thud + chassis + lp * Math.exp(-t / 0.016) * 0.24) * 1.15) * 0.86;
      }
    } else if (key === 'eswt_comp_loop') {
      // Clean medical diaphragm compressor hum (gentle rhythmic pulse, zero static hiss)
      const dur = 1.6;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const piston = 0.72 + 0.28 * Math.sin(2 * Math.PI * 16 * t);
        const motor =
          Math.sin(2 * Math.PI * 55 * t) * 0.46 +
          Math.sin(2 * Math.PI * 110 * t) * 0.22 +
          Math.sin(2 * Math.PI * 165 * t) * 0.07;
        lp = lp + 0.045 * ((Math.random() * 2 - 1) - lp);
        raw[i] = (motor * piston + lp * 0.48) * 0.52;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'cpm_motor_loop') {
      // Smooth brushless linear actuator whir (warm DC servo glide)
      const dur = 1.6;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const servo =
          Math.sin(2 * Math.PI * 96 * t) * 0.44 +
          Math.sin(2 * Math.PI * 192 * t) * 0.16;
        const ripple = 0.9 + 0.1 * Math.sin(2 * Math.PI * 9 * t);
        lp = lp + 0.04 * ((Math.random() * 2 - 1) - lp);
        raw[i] = (servo * ripple + lp * 0.35) * 0.55;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'cryo_pump_loop') {
      // Smooth chilled coolant circulation & gentle compressor purr
      const dur = 1.8;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        b0 = 0.994 * b0 + w * 0.025;
        b1 = 0.955 * b1 + b0 * 0.09;
        const pump = 0.78 + 0.22 * Math.sin(2 * Math.PI * 2.8 * t);
        const hum = Math.sin(2 * Math.PI * 58 * t) * 0.28 + Math.sin(2 * Math.PI * 116 * t) * 0.10;
        raw[i] = (b1 * 0.65 + hum) * pump;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'us_gel_loop') {
      // Quiet modern crystal ultrasound transducer hum + soft cooling airflow
      const dur = 1.8;
      const n = Math.floor(sr * (dur + 0.15));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        b0 = 0.995 * b0 + w * 0.018;
        b1 = 0.95 * b1 + b0 * 0.07;
        const piezo =
          Math.sin(2 * Math.PI * 110 * t) * 0.18 +
          Math.sin(2 * Math.PI * 220 * t) * 0.07 +
          Math.sin(2 * Math.PI * 1680 * t) * (0.018 + 0.01 * Math.sin(2 * Math.PI * 4 * t));
        raw[i] = b1 * 0.45 + piezo;
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.15);
    } else if (key === 'hydro_water_loop') {
      // Warm circulating hydrocollator / whirlpool water & soft micro-bubbles
      const dur = 2.8;
      const n = Math.floor(sr * (dur + 0.16));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.988 * b0 + w * 0.02;
        b1 = 0.945 * b1 + b0 * 0.12;
        raw[i] = b1 * 0.24;
      }
      for (let k = 0; k < 65; k++) {
        const start = Math.floor(Math.random() * (n - Math.floor(sr * 0.06)));
        const bDur = 0.018 + Math.random() * 0.032;
        const bLen = Math.floor(sr * bDur);
        const f0 = 260 + Math.random() * 520;
        const amp = 0.06 + Math.random() * 0.11;
        for (let j = 0; j < bLen && start + j < n; j++) {
          const u = j / bLen;
          const freq = f0 * (1 + 0.48 * u);
          const env = Math.sin(u * Math.PI) * Math.exp(-u * 1.75);
          raw[start + j] += Math.sin(2 * Math.PI * freq * (j / sr)) * env * amp;
        }
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.16);
    } else if (key === 'cart_roll_loop') {
      // Soft rubber caster wheels rolling over tiled clinic floor
      const dur = 1.6;
      const n = Math.floor(sr * (dur + 0.14));
      const raw = new Float32Array(n);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        lp = lp + 0.038 * (w - lp);
        const tilePhase = (t * 5.0) % 1;
        const bump = tilePhase < 0.07 ? Math.sin((tilePhase / 0.07) * Math.PI) * 0.38 : 0;
        raw[i] = lp * 1.15 + bump * (lp * 1.4 + Math.sin(2 * Math.PI * 76 * t) * 0.14);
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.14);
    } else {
      // Ultra-clean silent-grade medical cabinet ventilation hum (soft warm airflow, zero hiss)
      const dur = 1.8;
      const n = Math.floor(sr * (dur + 0.16));
      const raw = new Float32Array(n);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const w = Math.random() * 2 - 1;
        b0 = 0.996 * b0 + w * 0.018;
        b1 = 0.96 * b1 + b0 * 0.055;
        const cabinetHum = Math.sin(2 * Math.PI * 62 * t) * 0.14 + Math.sin(2 * Math.PI * 124 * t) * 0.05;
        raw[i] = Math.max(-1, Math.min(1, b1 * 0.85 + cabinetHum));
      }
      buf = this.makeSeamlessLoop(raw, sr, 0.16);
    }

    this.bufferCache.set(key, buf);
    return buf;
  }

  private playBufferOneShot(
    ctx: AudioContext,
    buf: AudioBuffer,
    volume: number,
    rate = 1.0,
    delay = 0,
    bus?: AudioNode
  ) {
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g);
    g.connect(bus ?? this.getMasterBus(ctx));
    src.start(now);
  }

  /**
   * Warm acoustic chime note (marimba/bell harmonic blend + soft felt attack) so UI cues sound crisp & pleasant.
   */
  private playChime(freq: number, duration: number, volume = 0.14, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const out = this.getMasterBus(ctx);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, now);

    g1.gain.setValueAtTime(0.0005, now);
    g1.gain.linearRampToValueAtTime(volume, now + 0.008);
    g1.gain.exponentialRampToValueAtTime(0.0005, now + duration);

    g2.gain.setValueAtTime(0.0005, now);
    g2.gain.linearRampToValueAtTime(volume * 0.24, now + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.0005, now + duration * 0.55);

    osc1.connect(g1);
    osc2.connect(g2);
    g1.connect(out);
    g2.connect(out);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.025);
    osc2.stop(now + duration + 0.025);
  }

  tap() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'ui_tap'), 0.26, 0.98 + Math.random() * 0.06);
  }

  placeItem() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'equip_thud'), 0.34, 1.15);
    this.playChime(440, 0.11, 0.11, 0.02);
  }

  coin() {
    this.playChime(1046.5, 0.12, 0.14, 0);
    this.playChime(1318.51, 0.20, 0.15, 0.055);
  }

  starSuccess() {
    this.playChime(523.25, 0.14, 0.14, 0);
    this.playChime(659.25, 0.14, 0.14, 0.075);
    this.playChime(783.99, 0.16, 0.15, 0.15);
    this.playChime(1046.5, 0.28, 0.17, 0.225);
  }

  alert() {
    this.playChime(392, 0.12, 0.15, 0);
    this.playChime(293.66, 0.20, 0.15, 0.09);
  }

  padStick() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'pad_stick'), 0.36, 0.96 + Math.random() * 0.08);
  }

  deviceToggle(on: boolean) {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.28, on ? 1.12 : 0.88);
    if (on) {
      this.playChime(880, 0.09, 0.1, 0.015);
    } else {
      this.playChime(523.25, 0.09, 0.085, 0.015);
    }
  }

  fppEquipGrab(isRollingCart: boolean) {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(
      ctx,
      this.getDeviceBuffer(ctx, 'equip_thud'),
      isRollingCart ? 0.28 : 0.22,
      isRollingCart ? 1.15 : 1.38
    );
    if (isRollingCart) {
      this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.18, 0.92, 0.018);
    }
  }

  fppEquipPlace(isRollingCart: boolean, nearBed: boolean) {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(
      ctx,
      this.getDeviceBuffer(ctx, 'equip_thud'),
      isRollingCart ? 0.36 : 0.28,
      isRollingCart ? 0.88 : 1.05
    );
    if (nearBed) {
      this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.22, 0.86, 0.035);
    }
  }

  fppEquipReturn() {
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'equip_thud'), 0.22, 1.25);
  }

  fppEquipAdjust(timeSec: number) {
    if (timeSec - this.lastAdjustCueAt < 0.22) return;
    this.lastAdjustCueAt = timeSec;
    const ctx = this.getCtx();
    if (!ctx) return;
    this.playBufferOneShot(ctx, this.getDeviceBuffer(ctx, 'switch_click'), 0.14, 0.74);
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
      const out = this.getDeviceBus(ctx);
      const masterGain = ctx.createGain();
      masterGain.gain.value = 0.0001;
      masterGain.connect(out);

      const src = ctx.createBufferSource();
      src.buffer = this.getDeviceBuffer(ctx, 'cart_roll_loop');
      src.loop = true;

      const rollLp = ctx.createBiquadFilter();
      rollLp.type = 'lowpass';
      rollLp.frequency.value = 520;
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

    const baseVol = isRollingCart ? 0.10 + clampedSpd * 0.22 : 0.03 + clampedSpd * 0.07;
    em.masterGain.gain.setTargetAtTime(baseVol, now, 0.045);
    em.rollLp.frequency.setTargetAtTime((isRollingCart ? 420 : 560) + clampedSpd * 420, now, 0.05);
  }

  private disposeEquipMove(ctx: AudioContext | null) {
    const em = this.equipMove;
    if (!em) return;
    this.equipMove = null;
    this.disposeNodeList(ctx, em.masterGain, em.nodes);
  }

  private playVoiceClip(
    ctx: AudioContext,
    key: string,
    volume: number,
    rateOffset = 1.0,
    isScream = false
  ) {
    const now = ctx.currentTime;
    if (this.activeVoice) {
      const prev = this.activeVoice;
      try {
        prev.gain.gain.cancelScheduledValues(now);
        prev.gain.gain.setTargetAtTime(0.0001, now, isScream ? 0.01 : 0.022);
        prev.src.stop(now + 0.055);
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
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + (isScream ? 0.012 : 0.022));
    gain.connect(this.getVoiceBus(ctx));

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
    this.activeVoice = { src, gain, isScream };

    // Duck running machines briefly when patient cries out or screams so the human voice stays clear & front-most
    if (this.deviceBus && (isScream || volume >= 0.78)) {
      const duckGain = isScream ? 0.42 : 0.65;
      const holdSec = Math.min(0.95, buf.duration / Math.max(0.8, rateOffset));
      this.voiceDuckUntil = Math.max(this.voiceDuckUntil, now + holdSec);
      this.deviceBus.gain.cancelScheduledValues(now);
      this.deviceBus.gain.setTargetAtTime(duckGain, now, 0.025);
      this.deviceBus.gain.setTargetAtTime(1.0, now + holdSec * 0.78, 0.16);
    }
  }

  syncPatientReaction(input: PatientReactionLiveInput, timeSec: number) {
    if (!this.enabled || !input.active) {
      if (this.activeVoice && this.ctx) {
        const now = this.ctx.currentTime;
        try {
          this.activeVoice.gain.gain.setTargetAtTime(0.0001, now, 0.045);
        } catch {
          // Ignore
        }
      }
      if (this.deviceBus && this.ctx) {
        this.deviceBus.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.08);
      }
      this.nextVoiceAt = 0;
      return;
    }

    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') return;

    if (timeSec - this.lastVoiceSyncAt < 0.032) return;
    this.lastVoiceSyncAt = timeSec;

    const lvl = Math.max(0, Math.min(1.3, input.intensity01));
    if (lvl < 0.24 && input.spike01 < 0.34) return;

    // First entry into stimulation: respond immediately if uncomfortable/high, slightly delayed if mild
    if (this.nextVoiceAt === 0 && input.spike01 < 0.34) {
      this.nextVoiceAt = timeSec + (lvl >= 0.84 ? 0.05 : lvl >= 0.58 ? 0.35 : 1.6);
      if (lvl < 0.84) return;
    }

    const prefix = input.isFemale ? 'f_' : 'm_';
    const isOverdose = lvl >= 0.86;
    const isSpike =
      input.spike01 >= 0.34 &&
      lvl >= 0.44 &&
      timeSec - this.lastVoiceSpikeAt >= (isOverdose ? 0.52 : 0.88);
    const isPeriodicDue = timeSec >= this.nextVoiceAt;

    if (!isSpike && !isPeriodicDue) return;

    this.voiceVariantIdx = (this.voiceVariantIdx + 1) % 2;
    const rateJitter = 0.96 + Math.random() * 0.08;

    let clipKey: string;
    let vol: number;
    let nextDelay: number;
    let isScream = false;

    if (isSpike) {
      this.lastVoiceSpikeAt = timeSec;
      if (lvl >= 0.86) {
        // Sudden overdose jump -> instant loud pain scream!
        this.screamVariantIdx = (this.screamVariantIdx + 1) % 3;
        clipKey =
          this.screamVariantIdx === 0
            ? `${prefix}scream_sharp`
            : this.screamVariantIdx === 1
              ? `${prefix}scream_0`
              : `${prefix}scream_1`;
        vol = Math.min(1.5, 1.18 + (lvl - 0.86) * 0.82);
        nextDelay = 1.05 + Math.random() * 0.35;
        isScream = true;
      } else if (lvl >= 0.66) {
        clipKey = `${prefix}groan_${this.voiceVariantIdx}`;
        vol = 0.92 + (lvl - 0.66) * 0.9;
        nextDelay = 1.45 + Math.random() * 0.45;
      } else if (lvl >= 0.48) {
        clipKey =
          input.kind === 'percussion' || input.kind === 'cold'
            ? `${prefix}gasp`
            : `${prefix}wince_${this.voiceVariantIdx}`;
        vol = 0.72 + (lvl - 0.48) * 0.9;
        nextDelay = 1.85 + Math.random() * 0.6;
      } else {
        clipKey = `${prefix}sigh_mild`;
        vol = 0.52 + (lvl - 0.32) * 0.65;
        nextDelay = 2.4 + Math.random() * 0.8;
      }
      this.nextVoiceAt = timeSec + nextDelay;
      this.playVoiceClip(ctx, clipKey, vol, rateJitter, isScream);
      return;
    }

    if (lvl >= 0.85) {
      // Sustained critical overdose -> loud urgent alternating screams & painful gasps!
      this.screamVariantIdx = (this.screamVariantIdx + 1) % 4;
      clipKey =
        this.screamVariantIdx === 0
          ? `${prefix}scream_0`
          : this.screamVariantIdx === 1
            ? `${prefix}scream_1`
            : this.screamVariantIdx === 2
              ? `${prefix}scream_sharp`
              : `${prefix}groan_${this.voiceVariantIdx}`;
      vol = Math.min(1.52, 1.18 + (lvl - 0.85) * 0.82);
      nextDelay = this.screamVariantIdx === 2 ? 0.95 : 1.25 + Math.random() * 0.4;
      isScream = this.screamVariantIdx !== 3;
    } else if (lvl >= 0.68) {
      clipKey = `${prefix}groan_${this.voiceVariantIdx}`;
      vol = 0.9 + (lvl - 0.68) * 1.1;
      nextDelay = 1.5 + Math.random() * 0.55;
    } else if (lvl >= 0.48) {
      clipKey = `${prefix}wince_${this.voiceVariantIdx}`;
      vol = 0.68 + (lvl - 0.48) * 0.95;
      nextDelay = 2.0 + Math.random() * 0.7;
    } else if (lvl >= 0.34) {
      clipKey = this.voiceVariantIdx === 0 ? `${prefix}sigh_mild` : `${prefix}breath_soft`;
      vol = 0.48 + (lvl - 0.34) * 0.8;
      nextDelay = 2.8 + Math.random() * 0.9;
    } else {
      clipKey = `${prefix}breath_soft`;
      vol = 0.34 + (lvl - 0.24) * 0.75;
      nextDelay = 3.8 + Math.random() * 1.2;
    }

    this.nextVoiceAt = timeSec + nextDelay;
    this.playVoiceClip(ctx, clipKey, vol, rateJitter, isScream);
  }

  private createDeviceHandle(ctx: AudioContext, item: ActiveDeviceAudioInput): DeviceAudioHandle | null {
    const now = ctx.currentTime;
    const sprite = item.sprite;
    const out = this.getDeviceBus(ctx);
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
      lp.frequency.setValueAtTime(720, now);
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
      lp.frequency.setValueAtTime(680, now);
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
      lp.frequency.setValueAtTime(1650, now);
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
      bp.type = 'lowpass';
      bp.frequency.setValueAtTime(640, now);

      const pulseOsc = ctx.createOscillator();
      pulseOsc.type = 'sine';
      pulseOsc.frequency.setValueAtTime(1320, now);
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
      lp.frequency.setValueAtTime(sprite === 'cryo_unit' ? 1100 : 780, now);
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
      lp.frequency.setValueAtTime(840, now);
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
      lp.frequency.setValueAtTime(480, now);
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
      lp.frequency.setValueAtTime(sprite === 'hydro_sink' ? 2400 : 620, now);
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
      lp.frequency.setValueAtTime(480, now);

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
      lp.frequency.setValueAtTime(640, now);
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
    const out = this.getDeviceBus(ctx);

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
        g.gain.value = 0.28 + bar01 * 0.24;
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
          g.gain.value = (0.065 + ma01 * 0.16) * contactMul * gate;
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
        h.pulseOsc.frequency.setValueAtTime(1280 + w01 * 140, pt);
        h.pulseGain.gain.setValueAtTime(0.0002, pt);
        h.pulseGain.gain.linearRampToValueAtTime(0.04 + w01 * 0.03, pt + 0.008);
        h.pulseGain.gain.exponentialRampToValueAtTime(0.0002, pt + 0.05);
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
          h.pulseOsc.frequency.setValueAtTime(520 + emgWave * 240, pt);
          h.pulseGain.gain.setValueAtTime(0.0002, pt);
          h.pulseGain.gain.linearRampToValueAtTime(0.095, pt + 0.015);
          h.pulseGain.gain.exponentialRampToValueAtTime(0.0002, pt + 0.11);
        }
        h.nextPulseAt += period;
      }
    } else if (h.sprite === 'balance_trainer' && h.pulseOsc && h.pulseGain) {
      const period = 1.6;
      if (h.nextPulseAt < now - 0.2) h.nextPulseAt = now + 0.1;
      while (h.nextPulseAt <= lookahead) {
        const pt = h.nextPulseAt;
        h.pulseGain.gain.setValueAtTime(0.0002, pt);
        h.pulseGain.gain.linearRampToValueAtTime(0.085, pt + 0.012);
        h.pulseGain.gain.exponentialRampToValueAtTime(0.0002, pt + 0.13);
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
        const peakVol = (0.03 + mT01 * 0.055) * gate;
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
      h.masterGain.gain.setTargetAtTime(0.02 + ma01 * 0.02, now, 0.05);
    } else if (h.sprite === 'shockwave_eswt') {
      const bar = Math.max(1, Math.min(5, Number(p?.intensity ?? 2.4)));
      const bar01 = (bar - 1) / 4;
      h.masterGain.gain.setTargetAtTime(0.08 + bar01 * 0.075, now, 0.05);
      h.src1?.playbackRate.setTargetAtTime(0.92 + bar01 * 0.18, now, 0.05);
    } else if (h.sprite === 'ultrasound_unit') {
      const w = Math.max(0.2, Math.min(2.5, Number(p?.intensity ?? 1.2)));
      const w01 = (w - 0.2) / 2.3;
      const duty = Number(p?.dutyPct ?? 50);
      let dutyGate = 1;
      if (duty < 95) {
        const phase = (timeSec * 3.5) % 1;
        dutyGate = phase < duty / 100 ? 1.0 : 0.35;
      }
      const contactMul = item.placedCount > 0 ? 1.0 : 0.45;
      h.masterGain.gain.setTargetAtTime((0.08 + w01 * 0.09) * dutyGate * contactMul, now, 0.04);
      h.src1?.playbackRate.setTargetAtTime(Number(p?.freqHz ?? 1) > 2 ? 1.12 : 0.96, now, 0.05);
    } else if (h.sprite === 'laser_hilt') {
      const watts = Math.max(2, Math.min(15, Number(p?.intensity ?? 10)));
      const w01 = (watts - 2) / 13;
      h.masterGain.gain.setTargetAtTime(0.06 + w01 * 0.05, now, 0.05);
    } else if (h.sprite === 'swd_unit') {
      const watts = Math.max(20, Math.min(200, Number(p?.intensity ?? 120)));
      const w01 = (watts - 20) / 180;
      const isPulsed = p?.mode === 'PULSED';
      const pulseGate = isPulsed ? (Math.sin(timeSec * Math.PI * 8) > 0 ? 1.0 : 0.45) : 1.0;
      h.masterGain.gain.setTargetAtTime((0.07 + w01 * 0.08) * pulseGate, now, 0.04);
    } else if (h.sprite === 'cryo_unit') {
      const mmHg = Math.max(20, Math.min(75, Number(p?.pressureMmHg ?? 45)));
      const mm01 = (mmHg - 20) / 55;
      const flowMul = p?.flow === 'HIGH' ? 1.12 : p?.flow === 'LOW' ? 0.74 : 0.94;
      h.masterGain.gain.setTargetAtTime((0.09 + mm01 * 0.085) * flowMul, now, 0.05);
      h.src1?.playbackRate.setTargetAtTime(0.9 + mm01 * 0.18, now, 0.05);
    } else if (h.sprite === 'cpm_device') {
      const speed = Math.max(1, Math.min(4, Number(p?.speed ?? 2)));
      const cycleRate = 0.65 + speed * 0.35;
      const strokeVel = Math.abs(Math.sin(timeSec * cycleRate));
      h.masterGain.gain.setTargetAtTime(0.08 + speed * 0.025 + strokeVel * 0.045, now, 0.04);
      h.src1?.playbackRate.setTargetAtTime(0.86 + speed * 0.06 + strokeVel * 0.14, now, 0.04);
    } else if (h.sprite === 'infrared_lamp') {
      const ir = Math.max(0.1, Math.min(1, item.irIntensity ?? 0.85));
      h.masterGain.gain.setTargetAtTime(0.035 + ir * 0.045, now, 0.05);
    } else if (h.sprite === 'hydro_sink' || h.sprite === 'paraffin_bath') {
      const temp = Number(p?.tempC ?? (h.sprite === 'hydro_sink' ? 74 : 53));
      const t01 = h.sprite === 'hydro_sink' ? (temp - 65) / 13 : (temp - 48) / 8;
      h.masterGain.gain.setTargetAtTime(
        (h.sprite === 'hydro_sink' ? 0.13 : 0.065) + Math.max(0, Math.min(1, t01)) * 0.075,
        now,
        0.05
      );
    } else if (h.sprite === 'emg_biofeedback' || h.sprite === 'balance_trainer') {
      h.masterGain.gain.setTargetAtTime(0.02, now, 0.05);
    } else if (h.sprite === 'magnetotherapy') {
      const mT = Math.max(10, Math.min(100, Number(p?.intensity ?? 45)));
      const mT01 = (mT - 10) / 90;
      const zone = p?.magnetZone ?? 'SCAN';
      const speed = Math.max(1, Math.min(3, Number(p?.speed ?? 2)));
      const scanGlide = zone === 'SCAN' ? 0.014 + speed * 0.005 : 0;
      h.masterGain.gain.setTargetAtTime(0.035 + mT01 * 0.035 + scanGlide, now, 0.06);
      h.filter1?.frequency.setTargetAtTime(420 + mT01 * 180 + (zone === 'SCAN' ? 70 : 0), now, 0.08);
    } else if (h.sprite === 'tilt_table') {
      const spd = Math.max(1, Math.min(3, Number(p?.speed ?? 2)));
      const motorActive = Boolean(item.isMoving);
      h.masterGain.gain.setTargetAtTime(motorActive ? 0.075 + spd * 0.028 : 0.0002, now, 0.05);
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
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') {
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
    if (this.deviceBus && this.ctx) {
      this.deviceBus.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.04);
    }
    this.disposeEquipMove(this.ctx);
    this.lastDeviceSyncAt = -1;
    this.lastVoiceSyncAt = -1;
    this.lastMoveSyncAt = -1;
    this.nextVoiceAt = 0;
    this.lastVoiceSpikeAt = -1;
    this.voiceDuckUntil = 0;
    if (!this.enabled) {
      this.clearCaches();
    }
  }

  warmup() {
    const ctx = this.getCtx();
    if (ctx) {
      this.ensureBuses(ctx);
    }
  }
}

export const soundFx = new SoundEngine();

if (typeof window !== 'undefined') {
  const unlock = () => {
    soundFx.warmup();
  };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true, once: true });
  window.addEventListener('touchend', unlock, { capture: true, passive: true, once: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true, once: true });
}
