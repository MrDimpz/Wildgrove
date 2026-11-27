// 100% Procedural Cozy Web Audio Synthesizer + Weather-Reactive Meadow Ambience
// (Zero external audio file dependencies)

export type AmbienceTheme = 'meadow' | 'autumn' | 'alpine' | 'clover';
export type AmbienceTimeOfDay = 'day' | 'sunset' | 'night';

class CozySoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  // Ambient music & nature layer state
  private ambienceEnabled = false;
  private ambienceTheme: AmbienceTheme = 'meadow';
  private ambienceTime: AmbienceTimeOfDay = 'day';
  private musicTimer: number | null = null;
  private natureTimer: number | null = null;
  private noiseNode: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private stepIdx = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (m) {
      this.stopAmbienceLoops();
    } else if (this.ambienceEnabled) {
      this.startAmbienceLoops();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public isAmbienceEnabled(): boolean {
    return this.ambienceEnabled;
  }

  public setAmbienceEnabled(enabled: boolean): void {
    this.ambienceEnabled = enabled;
    if (enabled && !this.muted) {
      this.startAmbienceLoops();
    } else {
      this.stopAmbienceLoops();
    }
  }

  public setAmbienceMood(theme: AmbienceTheme, timeOfDay: AmbienceTimeOfDay): void {
    this.ambienceTheme = theme;
    this.ambienceTime = timeOfDay;
    this.updateNatureBedProfile();
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  private startAmbienceLoops(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.musicTimer !== null) return;

    // Gentle filtered noise bed (breeze / rain / alpine wind)
    try {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Soft pink/brownian smoothing
        data[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = data[i];
      }
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 520;
      filter.Q.value = 0.9;

      const gain = ctx.createGain();
      gain.gain.value = 0.018;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();

      this.noiseNode = source;
      this.noiseFilter = filter;
      this.noiseGain = gain;
      this.updateNatureBedProfile();
    } catch {
      // Ignore audio hardware restrictions
    }

    // Soft acoustic pentatonic harp / kalimba melody every ~2.2s
    const dayScale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const nightScale = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];

    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ambienceEnabled) return;
      const scale = this.ambienceTime === 'night' ? nightScale : dayScale;
      const pattern = [0, 2, 4, 5, 4, 2, 3, 1];
      const baseIdx = pattern[this.stepIdx % pattern.length];
      this.stepIdx += 1;
      const note = scale[baseIdx % scale.length];
      const harmony = scale[(baseIdx + 2) % scale.length];
      this.playTone(note, 1.45, 'sine', 0.028, 0);
      if (this.stepIdx % 2 === 0) {
        this.playTone(harmony, 1.3, 'triangle', 0.016, 0.28);
      }
    }, 2200);

    // Subtle bird chirps (day) or warm crickets (night)
    this.natureTimer = window.setInterval(() => {
      if (this.muted || !this.ambienceEnabled) return;
      if (Math.random() > 0.6) return;
      if (this.ambienceTime === 'night') {
        // Gentle cricket pulse
        this.playTone(3900, 0.06, 'sine', 0.008, 0, 4050);
        this.playTone(3920, 0.06, 'sine', 0.008, 0.1, 4080);
      } else if (this.ambienceTheme !== 'clover') {
        // Soft sunlit songbird chirp
        const f = 1850 + Math.random() * 550;
        this.playTone(f, 0.09, 'sine', 0.014, 0, f * 1.24);
        this.playTone(f * 1.18, 0.11, 'sine', 0.012, 0.12, f * 0.96);
      }
    }, 4400);
  }

  private updateNatureBedProfile(): void {
    if (!this.noiseFilter || !this.noiseGain || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.ambienceTheme === 'clover') {
      // Gentle rain patter
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.setTargetAtTime(1150, now, 0.4);
      this.noiseGain.gain.setTargetAtTime(0.032, now, 0.4);
    } else if (this.ambienceTheme === 'alpine') {
      // Crisp mountain breeze
      this.noiseFilter.type = 'lowpass';
      this.noiseFilter.frequency.setTargetAtTime(420, now, 0.4);
      this.noiseGain.gain.setTargetAtTime(0.024, now, 0.4);
    } else {
      // Soft meadow rustle
      this.noiseFilter.type = 'bandpass';
      this.noiseFilter.frequency.setTargetAtTime(560, now, 0.4);
      this.noiseGain.gain.setTargetAtTime(0.016, now, 0.4);
    }
  }

  private stopAmbienceLoops(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.natureTimer !== null) {
      window.clearInterval(this.natureTimer);
      this.natureTimer = null;
    }
    if (this.noiseNode) {
      try {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      } catch {
        // Ignore
      }
      this.noiseNode = null;
      this.noiseFilter = null;
      this.noiseGain = null;
    }
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
