// Chime + vibration for a new job offer. Browsers only allow sound after the
// rider has tapped the page once, so the audio context is unlocked on first tap.
let ctx: AudioContext | null = null;

export function unlockRiderSound() {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function playOfferChime() {
  try {
    if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
  } catch {
    /* vibration not supported */
  }
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = start + i * 0.18;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
