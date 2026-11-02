/** Original groove. No samples from commercial tracks. */
export class Groove {
  ctx: AudioContext | null = null;
  noise: AudioBuffer | null = null;
  bpm = 104;
  private startAt = 0;
  private nextStep = 0;
  private stepIndex = 0;
  running = false;
  private master: GainNode | null = null;

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
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      this.master = master;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  start() {
    this.unlock();
    if (!this.ctx) return;
    this.startAt = this.ctx.currentTime + 0.06;
    this.nextStep = 0;
    this.stepIndex = 0;
    this.running = true;
  }

  stop() {
    this.running = false;
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
