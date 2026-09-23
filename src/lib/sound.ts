let context: AudioContext | undefined;
export function playSound(kind: 'correct' | 'wrong' | 'complete', enabled: boolean) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    const notes = kind === 'complete' ? [523, 659, 784] : kind === 'correct' ? [587, 784] : [220, 174];
    notes.forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      const at = context!.currentTime + index * 0.11;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(0.055, at + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
      oscillator.connect(gain); gain.connect(context!.destination); oscillator.start(at); oscillator.stop(at + 0.18);
    });
  } catch { /* Audio is optional, including on browsers without Web Audio. */ }
}
