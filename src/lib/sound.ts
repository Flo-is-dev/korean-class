import type { MusicTrack } from '../types';

export type SoundKind = 'tap' | 'tick' | 'flip' | 'correct' | 'wrong' | 'complete';

let context: AudioContext | undefined;
function audio() {
  context ??= new AudioContext();
  void context.resume().catch(() => {});
  return context;
}
// One enveloped oscillator. `to` glides the pitch over the whole note, `slide` starts it lower and
// settles within 80 ms (a plucked grace note), `vibrato` is a depth ratio that swells after the attack.
function voice(ctx: AudioContext, out: AudioNode, at: number, frequency: number, { type = 'sine' as OscillatorType, peak = 0.07, attack = 0.012, length = 0.2, to = frequency, slide = 1, vibrato = 0 } = {}) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type; oscillator.frequency.setValueAtTime(frequency * slide, at);
  if (slide !== 1) oscillator.frequency.exponentialRampToValueAtTime(frequency, at + 0.08);
  else if (to !== frequency) oscillator.frequency.exponentialRampToValueAtTime(to, at + length);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.4; depth.gain.value = 0;
    depth.gain.setValueAtTime(0, at + length * 0.15); depth.gain.linearRampToValueAtTime(frequency * vibrato, at + length * 0.5);
    lfo.connect(depth); depth.connect(oscillator.frequency); lfo.start(at); lfo.stop(at + length + 0.02);
  }
  gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(peak, at + attack); gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  oscillator.connect(gain); gain.connect(out); oscillator.start(at); oscillator.stop(at + length + 0.02);
}
// A short burst of filtered noise: shaker, rim or drum stick.
let noise: AudioBuffer | undefined;
function hit(ctx: AudioContext, out: AudioNode, at: number, frequency: number, peak: number, length: number) {
  if (!noise) {
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const samples = noise.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noise; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = 1.2;
  gain.gain.setValueAtTime(peak, at); gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter); filter.connect(gain); gain.connect(out); source.start(at); source.stop(at + length + 0.02);
}
export function playSound(kind: SoundKind, enabled: boolean) {
  if (!enabled) return;
  try {
    const ctx = audio(), now = ctx.currentTime, out = ctx.destination;
    if (kind === 'tap') voice(ctx, out, now, 660, { type: 'triangle', peak: 0.05, length: 0.07 });
    else if (kind === 'tick') voice(ctx, out, now, 1040, { type: 'triangle', peak: 0.075, attack: 0.004, length: 0.06 });
    else if (kind === 'flip') { voice(ctx, out, now, 300, { peak: 0.06, length: 0.11, to: 640 }); voice(ctx, out, now + 0.05, 900, { type: 'triangle', peak: 0.025, length: 0.08 }); }
    else if (kind === 'correct') [587.33, 783.99, 1174.66].forEach((frequency, index) => voice(ctx, out, now + index * 0.09, frequency, index === 2 ? { type: 'triangle', peak: 0.04, length: 0.35 } : {}));
    else if (kind === 'wrong') [233.08, 174.61].forEach((frequency, index) => voice(ctx, out, now + index * 0.13, frequency, { type: 'triangle', peak: 0.075, length: 0.24, to: frequency * 0.94 }));
    else [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => voice(ctx, out, now + index * 0.11, frequency, { length: index === 3 ? 0.6 : 0.2 }));
  } catch { /* Audio is optional, including on browsers without Web Audio. */ }
}

// Ambient music: each track writes one bar at a time, a little ahead of the audio clock.
interface Track { bar: number; play: (ctx: AudioContext, out: AudioNode, at: number, index: number) => void }

// Calm: slow pad chords under a sparse, random pentatonic melody.
const CHORDS = [[196, 261.63, 329.63], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
const MELODY = [392, 440, 523.25, 587.33, 659.25, 783.99, 880];
const calm: Track = { bar: 4.8, play(ctx, out, at, index) {
  for (const frequency of CHORDS[index % CHORDS.length]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.03, at + 1.4); gain.gain.setValueAtTime(0.03, at + 4.4); gain.gain.linearRampToValueAtTime(0, at + 6.2);
    oscillator.connect(gain); gain.connect(out); oscillator.start(at); oscillator.stop(at + 6.3);
  }
  for (let step = 0; step < 4; step++) {
    if (Math.random() < 0.6) voice(ctx, out, at + step * 1.2 + Math.random() * 0.15, MELODY[Math.floor(Math.random() * MELODY.length)], { type: 'triangle', peak: 0.035, attack: 0.02, length: 1.8 });
  }
} };

// Rhythm: a soft 92 BPM groove in A minor: kick, shaker and rim, a syncopated bass, chord stabs and four rotating motifs.
const BEAT = 60 / 92;
const GROOVE: [number, number[]][] = [[110, [220, 261.63, 329.63]], [87.31, [220, 261.63, 349.23]], [130.81, [196, 261.63, 329.63]], [98, [196, 246.94, 293.66]]];
const RIFF = [440, 523.25, 587.33, 659.25, 783.99, 880];
const MOTIFS = [[5, 0, 4, 0, 3, 0, 0, 1], [0, 3, 4, 0, 5, 0, 4, 0], [6, 0, 5, 4, 0, 3, 0, 0], [0, 0, 3, 0, 4, 3, 1, 0]];
const rhythm: Track = { bar: BEAT * 4, play(ctx, out, at, index) {
  const [root, chord] = GROOVE[index % GROOVE.length];
  for (const beat of [0, 2, 2.5]) voice(ctx, out, at + beat * BEAT, 110, { peak: beat === 2.5 ? 0.05 : 0.11, length: 0.22, to: 45 });
  for (let eighth = 0; eighth < 8; eighth++) hit(ctx, out, at + eighth * BEAT / 2, 7000, eighth % 2 ? 0.028 : 0.012, 0.05);
  for (const beat of [1, 3]) hit(ctx, out, at + beat * BEAT, 1800, 0.04, 0.12);
  for (const [beat, frequency] of [[0, root], [1.5, root], [3, root * 1.5], [3.5, root]]) voice(ctx, out, at + beat * BEAT, frequency, { type: 'triangle', peak: 0.085, length: 0.32 });
  for (const beat of [1.5, 3.5]) for (const frequency of chord) voice(ctx, out, at + beat * BEAT, frequency, { type: 'triangle', peak: 0.028, length: 0.45 });
  MOTIFS[(index + Math.floor(index / 4)) % MOTIFS.length].forEach((degree, step) => {
    if (degree) voice(ctx, out, at + step * BEAT / 2, RIFF[degree - 1], { type: 'triangle', peak: 0.05, length: 0.5 });
  });
} };

// Korean: a gayageum-like line in a sol-la-do-re-mi mode over the semachi jangdan (9/8: 덩 – – 덩 – 덕 쿵 덕 –),
// with sliding grace notes, a wide vibrato on held tones and a breathy daegeum-like tone every other bar.
const EIGHTH = 0.36;
const TORI = [196, 220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
const PHRASES = [[6, 0, 0, 7, 0, 6, 5, 0, 0], [5, 0, 6, 7, 0, 0, 8, 7, 0], [8, 0, 0, 9, 8, 7, 6, 0, 0], [7, 0, 6, 5, 0, 4, 5, 0, 0], [4, 0, 5, 6, 0, 0, 3, 0, 0], [6, 0, 0, 0, 0, 0, 0, 0, 0]];
const SEQUENCE = [0, 1, 2, 3, 0, 4, 2, 5];
const korean: Track = { bar: EIGHTH * 9, play(ctx, out, at, index) {
  const kung = (step: number, level = 1) => voice(ctx, out, at + step * EIGHTH, 105, { peak: 0.12 * level, length: 0.3, to: 70 });
  const deok = (step: number, level = 1) => hit(ctx, out, at + step * EIGHTH, 2400, 0.05 * level, 0.07);
  kung(0); deok(0); kung(3, 0.8); deok(3, 0.8); deok(5); kung(6); deok(7, 0.8);
  if (index % 4 === 3) for (let roll = 0; roll < 4; roll++) deok(8 + roll * 0.22, 0.45);
  const phrase = PHRASES[SEQUENCE[index % SEQUENCE.length]];
  phrase.forEach((degree, step) => {
    if (!degree) return;
    const rest = phrase.slice(step + 1).findIndex(Boolean);
    const length = Math.max(0.6, (rest < 0 ? 9 - step : rest + 1) * EIGHTH * 1.7);
    const options = { peak: 0.085, attack: 0.004, length, slide: Math.random() < 0.3 ? 0.89 : 1, vibrato: length > 1.2 ? 0.02 : 0 };
    voice(ctx, out, at + step * EIGHTH, TORI[degree - 1], { ...options, type: 'triangle' });
    voice(ctx, out, at + step * EIGHTH, TORI[degree - 1] * 2, { ...options, peak: 0.02, length: length * 0.6 });
  });
  if (index % 2) voice(ctx, out, at, TORI[phrase[0] - 1] / 2, { peak: 0.04, attack: 0.3, length: EIGHTH * 8, vibrato: 0.025 });
} };

const tracks: Record<MusicTrack, Track> = { calm, rhythm, korean };
let musicGain: GainNode | undefined;
let musicTimer: ReturnType<typeof setInterval> | undefined;
let playing: MusicTrack | null = null;
let listening = false;
const unlock = () => { void context?.resume().catch(() => {}); };
export function setMusic(track: MusicTrack | null) {
  try {
    if (track === playing) return;
    clearInterval(musicTimer); musicTimer = undefined;
    // The previous track keeps its own gain node, so what it already scheduled fades out with it.
    if (context && musicGain) musicGain.gain.setTargetAtTime(0, context.currentTime, 0.2);
    musicGain = undefined; playing = track;
    if (!track) return;
    const ctx = audio();
    if (!listening) {
      listening = true;
      // Browsers keep audio suspended until a gesture, and the music should not play in a hidden tab.
      document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
      document.addEventListener('visibilitychange', () => { if (document.hidden) void context?.suspend(); else if (musicTimer) unlock(); });
    }
    const out = musicGain = ctx.createGain();
    out.gain.value = 0; out.connect(ctx.destination); out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    const { bar, play } = tracks[track];
    let next = 0;
    let index = 0;
    const tick = () => {
      next = Math.max(next, ctx.currentTime + 0.1);
      while (next < ctx.currentTime + 1.5) { play(ctx, out, next, index++); next += bar; }
    };
    tick(); musicTimer = setInterval(tick, 500);
  } catch { /* Audio is optional, including on browsers without Web Audio. */ }
}
