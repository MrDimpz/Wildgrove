// 100% Procedural Cozy Web Audio Synthesizer (zero external audio file dependencies)

class CozySoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    delay = 0,
    slideToFreq?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick(): void {
    this.playTone(540, 0.07, 'sine', 0.08, 0, 420);
  }

  public playPlace(): void {
    // Cozy wooden marimba double knock
    this.playTone(330, 0.12, 'triangle', 0.15, 0, 392);
    this.playTone(494, 0.15, 'sine', 0.12, 0.055);
  }

  public playHarvest(): void {
    // Cheerful ascending kalimba triad
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.18, 'triangle', 0.12, idx * 0.055);
    });
  }

  public playFeedHit(combo = 1): void {
    const base = 440 * Math.pow(1.06, Math.min(combo, 10));
    this.playTone(base, 0.14, 'triangle', 0.14, 0, base * 1.25);
    this.playTone(base * 1.5, 0.16, 'sine', 0.09, 0.04);
  }

  public playGroomSparkle(): void {
    const pitches = [698.46, 880, 1046.5, 1174.66];
    const p = pitches[Math.floor(Math.random() * pitches.length)];
    this.playTone(p, 0.14, 'sine', 0.07, 0, p * 1.12);
  }

  public playCelebration(): void {
    const chord = [523.25, 659.25, 783.99, 987.77, 1046.5];
    chord.forEach((freq, i) => {
      this.playTone(freq, 0.34, 'triangle', 0.12, i * 0.065);
    });
  }

  public playCoin(): void {
    this.playTone(987.77, 0.09, 'sine', 0.1, 0);
    this.playTone(1318.51, 0.22, 'sine', 0.11, 0.07);
  }

  public playError(): void {
    this.playTone(220, 0.16, 'sawtooth', 0.06, 0, 165);
  }
}

export const soundEngine = new CozySoundEngine();
