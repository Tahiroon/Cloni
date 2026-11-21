class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.08, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  tap() {
    this.playTone(540, 0.06, 'triangle', 0.05);
  }

  placeItem() {
    this.playTone(220, 0.08, 'sine', 0.08, 0);
    this.playTone(330, 0.1, 'triangle', 0.06, 0.04);
  }

  coin() {
    this.playTone(987.77, 0.09, 'sine', 0.07, 0);
    this.playTone(1318.51, 0.16, 'sine', 0.07, 0.06);
  }

  starSuccess() {
    this.playTone(523.25, 0.1, 'triangle', 0.07, 0);
    this.playTone(659.25, 0.1, 'triangle', 0.07, 0.08);
    this.playTone(783.99, 0.12, 'triangle', 0.07, 0.16);
    this.playTone(1046.5, 0.22, 'sine', 0.08, 0.24);
  }

  alert() {
    this.playTone(340, 0.12, 'sawtooth', 0.05, 0);
    this.playTone(280, 0.16, 'sawtooth', 0.05, 0.11);
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
