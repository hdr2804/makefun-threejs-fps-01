// Procedural sound: every effect is synthesised with WebAudio, so the game
// ships no audio files and makes no network request.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this._noiseBuf = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.enabled = false;
    }
  }

  _noise(dur, filterFreq, type, gain, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _tone(freq, dur, type, gain, slideTo = null, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // kind: 'rifle' | 'smg' | 'sniper' | 'shotgun' | 'pistol'
  shot(kind, distant = false) {
    if (!this.ctx || !this.enabled) return;
    const g = distant ? 0.10 : 0.5;
    switch (kind) {
      case 'sniper':
        this._noise(0.28, 900, 'lowpass', g);
        this._tone(140, 0.18, 'sawtooth', g * 0.5, 55);
        break;
      case 'shotgun':
        this._noise(0.22, 700, 'lowpass', g);
        this._noise(0.12, 3200, 'bandpass', g * 0.4);
        break;
      case 'smg':
        this._noise(0.09, 1800, 'bandpass', g * 0.8);
        this._tone(220, 0.06, 'square', g * 0.25, 90);
        break;
      case 'pistol':
        this._noise(0.11, 1400, 'bandpass', g * 0.9);
        break;
      case 'rifle':
      default:
        this._noise(0.14, 1100, 'lowpass', g);
        this._tone(170, 0.09, 'sawtooth', g * 0.35, 70);
    }
  }

  dryFire() { this._tone(900, 0.04, 'square', 0.12); }
  reload() {
    this._tone(500, 0.05, 'square', 0.10);
    this._tone(700, 0.05, 'square', 0.10, null, 0.18);
    this._tone(1000, 0.05, 'square', 0.12, null, 0.42);
  }
  hit() { this._tone(1250, 0.06, 'sine', 0.22); }
  kill() {
    this._tone(880, 0.07, 'sine', 0.22);
    this._tone(1318, 0.1, 'sine', 0.22, null, 0.07);
  }
  hurt() {
    this._tone(180, 0.16, 'sawtooth', 0.25, 90);
    this._noise(0.12, 500, 'lowpass', 0.2);
  }
  plantBeep(final = false) {
    this._tone(final ? 1567 : 1046, final ? 0.3 : 0.09, 'sine', 0.2);
  }
  roundWin() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.22, null, i * 0.11));
  }
  roundLose() {
    [392, 330, 262].forEach((f, i) => this._tone(f, 0.28, 'triangle', 0.2, null, i * 0.13));
  }
  buy() { this._tone(1567, 0.08, 'sine', 0.16); this._tone(2093, 0.1, 'sine', 0.14, null, 0.07); }
  denied() { this._tone(220, 0.14, 'square', 0.14, 160); }
  step() { this._noise(0.05, 400, 'lowpass', 0.05); }
  explode() {
    this._noise(0.9, 300, 'lowpass', 0.9);
    this._tone(70, 0.7, 'sine', 0.5, 30);
  }
}
