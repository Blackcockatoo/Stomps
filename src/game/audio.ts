/**
 * Original groove. No samples from commercial tracks.
 *
 * Optional recorded soundtrack: if the build finds public/audio/neon-strut.ogg
 * and/or .mp3 it writes `<meta name="moss-soundtrack" content="/audio/...">`
 * into index.html (no runtime 404 probing, no inline script). The groove then
 * fetches and decodes it on first unlock and, for strut and rhythm runs, loops
 * it from the same `startAt` the beat clock uses, muting only the synth's
 * drums and bass; every SFX and the calibration click stay synthesised. The
 * file must be 104 BPM with its first downbeat at 0 s to stay in sync. If it
 * is missing, fails to download or will not decode, the synth plays as before.
 */

/** Soundtrack URLs advertised by the build, in preference order. */
export function soundtrackUrls(): string[] {
  if (typeof document === "undefined") return [];
  const content = document.querySelector('meta[name="moss-soundtrack"]')?.getAttribute("content") ?? "";
  return content.split(",").map((url) => url.trim()).filter((url) => /^\/audio\/[\w.-]+\.(ogg|mp3)$/.test(url));
}

/** First URL the browser says it can play (by extension), else the first one. */
export function pickTrack(urls: string[], canPlay: (mime: string) => string): string | null {
  const mime = (url: string) => (url.endsWith(".ogg") ? 'audio/ogg; codecs="vorbis"' : "audio/mpeg");
  return urls.find((url) => canPlay(mime(url)) !== "") ?? urls[0] ?? null;
}

export class Groove {
  ctx: AudioContext | null = null;
  noise: AudioBuffer | null = null;
  bpm = 104;
  private startAt = 0;
  private nextStep = 0;
  private stepIndex = 0;
  running = false;
  /** Tap-along calibration: the loop is replaced by a plain beat click. */
  metronome = false;
  private master: GainNode | null = null;
  private volume = 0.8;
  private muted = false;
  /** Overall level at volume 1. The pre-P1 fixed master was 0.22 (volume 0.8 here is the same level). */
  static readonly MAX_GAIN = 0.275;
  /** Recorded soundtrack (see header); null keeps the synth groove. */
  trackUrl: string | null = null;
  track: AudioBuffer | null = null;
  private trackLoading = false;
  private trackSource: AudioBufferSourceNode | null = null;

  /** True while the recorded track is standing in for the synth loop. */
  get recorded() {
    return !!this.track && this.running && !this.metronome;
  }

  /** Player volume 0..1 and mute; applied immediately with a short ramp to avoid clicks. */
  setLevel(volume: number, muted: boolean) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.8));
    this.muted = muted;
    const master = this.master;
    if (master && this.ctx) {
      master.gain.cancelScheduledValues(this.ctx.currentTime);
      master.gain.setTargetAtTime(this.gainTarget(), this.ctx.currentTime, 0.015);
    }
  }

  gainTarget() {
    return this.muted ? 0 : Groove.MAX_GAIN * this.volume;
  }

  get stepDur() {
    return 60 / this.bpm / 2;
  }

  get beatDur() {
    return 60 / this.bpm;
  }

  now() {
    if (!this.ctx || !this.running) return 0;
    return Math.max(0, this.ctx.currentTime - this.startAt);
  }

  unlock() {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 1;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = seed / 2147483647 * 2 - 1;
      }
      this.noise = buffer;
      const master = ctx.createGain();
      master.gain.value = this.gainTarget();
      master.connect(ctx.destination);
      this.master = master;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.loadTrack();
  }

  private loadTrack() {
    const ctx = this.ctx;
    if (!ctx || !this.trackUrl || this.track || this.trackLoading) return;
    this.trackLoading = true;
    fetch(this.trackUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`soundtrack ${res.status}`);
        return res.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes))
      .then((buffer) => {
        this.track = buffer;
        // Decoded mid-run: join the loop at the current beat position.
        if (this.running && !this.metronome) this.playTrack();
      })
      .catch(() => {
        // Keep the synth.
        this.trackUrl = null;
      });
  }

  private playTrack() {
    const ctx = this.ctx;
    if (!ctx || !this.track) return;
    this.stopTrack();
    const src = ctx.createBufferSource();
    src.buffer = this.track;
    src.loop = true;
    src.connect(this.out());
    const late = Math.max(0, ctx.currentTime - this.startAt);
    src.start(Math.max(ctx.currentTime, this.startAt), late % this.track.duration);
    this.trackSource = src;
  }

  private stopTrack() {
    try {
      this.trackSource?.stop();
    } catch {
      // Already stopped.
    }
    this.trackSource?.disconnect();
    this.trackSource = null;
  }

  start(metronome = false) {
    this.metronome = metronome;
    this.unlock();
    if (!this.ctx) return;
    this.startAt = this.ctx.currentTime + 0.06;
    this.nextStep = 0;
    this.stepIndex = 0;
    this.running = true;
    if (metronome) this.stopTrack();
    else this.playTrack();
  }

  stop() {
    this.running = false;
    this.stopTrack();
  }

  suspend() {
    void this.ctx?.suspend();
  }

  resume() {
    void this.ctx?.resume();
  }

  pump() {
    if (!this.running || !this.ctx) return;
    const horizon = this.now() + 0.14;
    while (this.nextStep < horizon) {
      this.schedule(this.stepIndex, this.startAt + this.nextStep);
      this.stepIndex += 1;
      this.nextStep += this.stepDur;
    }
  }

  private out(): AudioNode {
    return this.master ?? this.ctx!.destination;
  }

  private tone(
    when: number,
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), when + dur);
    amp.gain.setValueAtTime(gain, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(amp);
    amp.connect(this.out());
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private burst(when: number, dur: number, gain: number, hp: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, when);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.out());
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  private schedule(step: number, when: number) {
    const s = step % 16;
    if (this.metronome) {
      // One click per beat, accented on the bar, nothing else to listen past.
      if (s % 2 === 0) this.tone(when, s % 8 === 0 ? 1320 : 880, 0.05, "square", 0.16);
      return;
    }
    if (this.recorded) return;
    if (s % 4 === 0) this.tone(when, 150, 0.12, "sine", 0.55, 48);
    if (s === 4 || s === 12) {
      this.burst(when, 0.14, 0.28, 900);
      this.tone(when, 220, 0.08, "triangle", 0.12);
    }
    if (s % 2 === 0) this.burst(when, 0.03, 0.06, 4000);
    else this.burst(when, 0.02, 0.035, 6000);
    const bass = [0, 0, 3, 0, 7, 5, 3, 5, 0, 0, 10, 7, 5, 3, 5, 7][s] ?? 0;
    const freq = 55 * 2 ** (bass / 12);
    this.tone(when, freq, this.stepDur * 0.9, "square", 0.08);
    // Off-beat minor-chord stabs moving every two bars, and an open hat to turn the bar.
    if (s === 3 || s === 11) {
      const root = 220 * 2 ** ((step % 32 < 16 ? 0 : -4) / 12);
      for (const semis of [0, 3, 7]) this.tone(when, root * 2 ** (semis / 12), this.stepDur * 1.4, "triangle", 0.035);
    }
    if (s === 14) this.burst(when, 0.11, 0.045, 7000);
  }

  stomp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 120, 0.18, "sine", 0.5, 40);
    this.burst(t, 0.12, 0.22, 200);
  }

  style() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 660, 0.08, "square", 0.06);
    this.tone(t + 0.06, 880, 0.1, "square", 0.05);
  }

  cue() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 740, 0.045, "square", 0.035);
    this.tone(t + 0.05, 980, 0.06, "square", 0.03);
  }

  perfect() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 523, 0.1, "square", 0.05);
    this.tone(t + 0.05, 659, 0.12, "square", 0.05);
  }

  miss() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 110, 0.16, "sawtooth", 0.05, 70);
  }

  quake() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 90, 0.45, "sine", 0.7, 28);
    this.burst(t, 0.4, 0.4, 120);
    this.tone(t + 0.08, 196, 0.3, "square", 0.08);
  }

  combo() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(t, 392, 0.08, "square", 0.06);
    this.tone(t + 0.07, 523, 0.1, "square", 0.06);
    this.tone(t + 0.14, 784, 0.14, "square", 0.05);
  }
}
