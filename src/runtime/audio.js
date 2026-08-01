export class AudioSystem {
  constructor() {
    this.context = null;
    this.lastHitAt = 0;
  }

  unlock() {
    if (!this.context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') this.context.resume();
  }

  tone(frequency, duration, volume = 0.035, type = 'sine', delay = 0) {
    if (!this.context || this.context.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.72), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  handle(events) {
    for (const event of events) {
      if (event.type === 'hit' && performance.now() - this.lastHitAt > 45) {
        this.tone(event.element === 'fire' ? 180 : 310, 0.045, 0.018, 'square');
        this.lastHitAt = performance.now();
      } else if (event.type === 'kill') {
        this.tone(125, 0.09, 0.028, 'triangle');
      } else if (event.type === 'xp') {
        this.tone(620, 0.055, 0.018, 'sine');
      } else if (event.type === 'levelUp') {
        this.tone(440, 0.16, 0.04, 'triangle');
        this.tone(660, 0.18, 0.04, 'triangle', 0.11);
      } else if (event.type === 'hurt') {
        this.tone(92, 0.22, 0.06, 'sawtooth');
      } else if (event.type === 'reactionActivate') {
        this.tone(196, 0.22, 0.035, 'triangle');
        this.tone(294, 0.25, 0.03, 'triangle', 0.06);
        this.tone(392, 0.28, 0.028, 'triangle', 0.12);
      } else if (event.type === 'reactionHit') {
        this.tone(240, 0.08, 0.022, 'sawtooth');
      } else if (event.type === 'gameOver') {
        this.tone(150, 0.45, 0.06, 'sawtooth');
      }
    }
  }
}
