export type SoundKind = 'tap' | 'flip' | 'correct' | 'wrong' | 'complete';

let context: AudioContext | undefined;
function audio() {
  context ??= new AudioContext();
  void context.resume().catch(() => {});
  return context;
}
// One enveloped oscillator; `to` glides the pitch for sweeps.
function voice(ctx: AudioContext, out: AudioNode, at: number, frequency: number, { type = 'sine' as OscillatorType, peak = 0.07, attack = 0.012, length = 0.2, to = frequency } = {}) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
  if (to !== frequency) oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + attack); gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(gain); gain.connect(out); oscillator.start(at); oscillator.stop(at + length + 0.02);
}
export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx = audio(), now = ctx.currentTime, out = ctx.destination;
    if (kind === 'tap') voice(ctx, out, now, 660, { type: 'triangle', peak: 0.05, length: 0.07 });
    else if (kind === 'flip') { voice(ctx, out, now, 300, { peak: 0.06, length: 0.11, to: 640 }); voice(ctx, out, now + 0.05, 900, { type: 'triangle', peak: 0.025, length: 0.08 }); }
    else if (kind === 'correct') [587.33, 783.99, 1174.66].forEach((frequency, index) => voice(ctx, out, now + index * 0.09, frequency, index === 2 ? { type: 'triangle', peak: 0.04, length: 0.35 } : {}));
    else if (kind === 'wrong') [233.08, 174.61].forEach((frequency, index) => voice(ctx, out, now + index * 0.13, frequency, { type: 'triangle', peak: 0.075, length: 0.24, to: frequency * 0.94 }));
    else [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => voice(ctx, out, now + index * 0.11, frequency, { length: index === 3 ? 0.6 : 0.2 }));
  } catch { /* Audio is optional, including on browsers without Web Audio. */ }
}

// Ambient loop: slow pad chords under a sparse pentatonic melody, scheduled a little ahead of the audio clock.
const BAR = 4.8;
const CHORDS = [[196, 261.63, 329.63], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
const MELODY = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
let musicGain: GainNode | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let nextBar = 0;
let bars = 0;
function scheduleBar(ctx: AudioContext, out: AudioNode, at: number, index: number) {
  for (const frequency of CHORDS[index % CHORDS.length]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.03, at + 1.4); gain.gain.setValueAtTime(0.03, at + BAR - 0.4); gain.gain.linearRampToValueAtTime(0, at + BAR + 1.4);
    oscillator.connect(gain); gain.connect(out); oscillator.start(at); oscillator.stop(at + BAR + 1.5);
  }
  for (let step = 0; step < 4; step++) {
    if (Math.random() < 0.6) voice(ctx, out, at + step * BAR / 4 + Math.random() * 0.15, MELODY[Math.floor(Math.random() * MELODY.length)], { type: 'triangle', peak: 0.035, attack: 0.02, length: 1.8 });
  }
}
const unlock = () => { void context?.resume().catch(() => {}); };
export function setMusic(enabled: boolean) {
  try {
    if (!enabled) {
      clearInterval(musicTimer); musicTimer = undefined;
      if (context && musicGain) musicGain.gain.setTargetAtTime(0, context.currentTime, 0.25);
      return;
    }
    if (musicTimer) return;
    const ctx = audio();
    if (!musicGain) {
      musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(ctx.destination);
      // Browsers keep audio suspended until a gesture, and the music should not play in a hidden tab.
      document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
      document.addEventListener('visibilitychange', () => { if (document.hidden) void context?.suspend(); else if (musicTimer) unlock(); });
    }
    const out = musicGain;
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    const tick = () => {
      nextBar = Math.max(nextBar, ctx.currentTime + 0.1);
      while (nextBar < ctx.currentTime + 1.5) { scheduleBar(ctx, out, nextBar, bars++); nextBar += BAR; }
    };
    tick(); musicTimer = setInterval(tick, 500);
  } catch { /* Audio is optional, including on browsers without Web Audio. */ }
}
