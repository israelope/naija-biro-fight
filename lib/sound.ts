// Procedural, physically-flavoured sound: plastic knocks, desk friction, floor thuds. No audio files.
let ctx: AudioContext | null = null;
let muted = false;
let slideSrc: AudioBufferSourceNode | null = null, slideGain: GainNode | null = null, slideFilter: BiquadFilterNode | null = null;
if (typeof window !== 'undefined') { try { muted = localStorage.getItem('nbf_muted') === '1'; } catch {} }

function ac(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null;
  if (!ctx) { try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number, delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBuf(c: AudioContext, dur: number) {
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function burst(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'bandpass', delay = 0) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = noiseBuf(c, dur); f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}

export const sfx = {
  isMuted: () => muted,
  setMuted(m: boolean) { muted = m; if (m) sfx.slideStop(); try { localStorage.setItem('nbf_muted', m ? '1' : '0'); } catch {} },
  click: () => burst(0.03, 0.12, 2400, 2),
  flick: (p: number) => { burst(0.05, 0.18 + p * 0.2, 3200, 1.2); tone(160 + p * 80, 0.07, 'triangle', 0.1, 90); },
  hit: (speed: number) => {
    const v = Math.min(1, speed / 220);
    burst(0.05 + v * 0.05, 0.18 + v * 0.4, 1800 + v * 1400, 1.4);          // plastic on plastic
    tone(240 + v * 120, 0.09, 'sine', 0.12 + v * 0.22, 120);                 // body of the knock
    tone(1900 + v * 600, 0.04, 'triangle', 0.04 + v * 0.05);                 // click of the nib
  },
  heavy: () => { tone(90, 0.28, 'sine', 0.3, 50); burst(0.12, 0.3, 700, 0.8); },
  fall: () => {                                                              // desk edge -> floor
    tone(110, 0.22, 'sine', 0.28, 55, 0.18); burst(0.1, 0.35, 900, 0.7, 'lowpass', 0.18);
    burst(0.05, 0.18, 2200, 1.3, 'bandpass', 0.38); burst(0.04, 0.1, 2600, 1.3, 'bandpass', 0.5);
  },
  roundWin: () => { tone(660, 0.5, 'sine', 0.08); tone(990, 0.5, 'sine', 0.05, undefined, 0.02); },
  roundLose: () => { tone(220, 0.45, 'sine', 0.09, 160); },
  win: () => [523, 659, 784].forEach((f, i) => { tone(f, 0.7, 'sine', 0.09, undefined, i * 0.16); tone(f * 2, 0.5, 'sine', 0.03, undefined, i * 0.16); }),
  lose: () => [330, 262, 196].forEach((f, i) => tone(f, 0.6, 'sine', 0.08, undefined, i * 0.22)),
  coin: () => { tone(2637, 0.12, 'sine', 0.06); tone(3520, 0.28, 'sine', 0.05, undefined, 0.05); burst(0.02, 0.1, 5000, 3, 'highpass'); },
  tick: () => tone(1200, 0.03, 'square', 0.03),

  /** Continuous desk-friction hiss. Call every frame with 0..1 (1 = fast). */
  slide(v: number) {
    const c = ac(); if (!c) return;
    if (!slideSrc) {
      slideSrc = c.createBufferSource(); slideSrc.buffer = noiseBuf(c, 2); slideSrc.loop = true;
      slideFilter = c.createBiquadFilter(); slideFilter.type = 'bandpass'; slideFilter.Q.value = 0.6; slideFilter.frequency.value = 900;
      slideGain = c.createGain(); slideGain.gain.value = 0;
      slideSrc.connect(slideFilter).connect(slideGain).connect(c.destination); slideSrc.start();
    }
    slideGain!.gain.setTargetAtTime(Math.min(0.16, v * 0.2), c.currentTime, 0.04);
    slideFilter!.frequency.setTargetAtTime(500 + v * 1500, c.currentTime, 0.05);
  },
  slideStop() {
    if (slideGain && ctx) slideGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  },
};
