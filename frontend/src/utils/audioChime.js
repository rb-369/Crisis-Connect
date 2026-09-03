/**
 * CrisisConnect — Web Audio API Sound Generator
 * Generates crisp, zero-latency chimes for emergency alerts and donor matches
 * without requiring external audio files or network requests.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a pleasant, upbeat chime when a donor/volunteer accepts a request.
 * Two harmonious ascending bells (D5 -> A5).
 */
export function playMatchSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First note: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second note: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.18);
    gain2.gain.setValueAtTime(0.3, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.75);

    // Third sparkle: 1174.66 Hz (D6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(1174.66, now + 0.35);
    gain3.gain.setValueAtTime(0.2, now + 0.35);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.35);
    osc3.stop(now + 0.9);
  } catch (err) {
    console.warn('Audio chime playback suppressed by browser policy:', err);
  }
}

/**
 * Plays an urgent radar chime when a compatible blood emergency arrives for a donor.
 */
export function playEmergencyAlertChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Double pulse: 784 Hz (G5) -> 659.25 Hz (E5)
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now + offset);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + offset + 0.14);
      gain.gain.setValueAtTime(0.25, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.15);
    });
  } catch (err) {
    console.warn('Emergency alert chime playback suppressed by browser policy:', err);
  }
}
