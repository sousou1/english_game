// 効果音(WebAudio)と読み上げ(speechSynthesis)。
// どちらもユーザー操作後に初期化が必要(特にiOS)。

let ctx = null;
let voice = null;
let voiceLoaded = false;

export function initAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // iOSはバックグラウンド復帰後にinterrupted/suspendedのまま戻らないことがある
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
      });
    } catch (e) { /* 音なしでも遊べる */ }
  }
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  loadVoice();
  // iOSはユーザー操作内で一度speakしないとTTSが解放されないことがある
  if (ttsAvailable() && !loadVoice._warmed) {
    loadVoice._warmed = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
}

export function ttsAvailable() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function loadVoice() {
  if (!ttsAvailable() || voiceLoaded) return;
  const pick = () => {
    const vs = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
    if (!vs.length) return;
    const pref = ['google us english', 'samantha', 'aaron', 'daniel', 'karen', 'microsoft'];
    voice = vs.find((v) => pref.some((p) => v.name.toLowerCase().includes(p)) && v.lang.startsWith('en-US'))
      || vs.find((v) => v.lang.startsWith('en-US'))
      || vs[0];
    voiceLoaded = true;
  };
  pick();
  if (!voiceLoaded) speechSynthesis.addEventListener('voiceschanged', pick, { once: true });
}

export function speak(text, rate = 0.95) {
  if (!ttsAvailable() || !text) return false;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1;
    // Android Chromeはcancel()直後の同期speak()が破棄されることがあるため少し空ける
    const busy = speechSynthesis.speaking || speechSynthesis.pending;
    if (busy) {
      speechSynthesis.cancel();
      setTimeout(() => { try { speechSynthesis.speak(u); } catch (e) { /* ignore */ } }, 80);
    } else {
      speechSynthesis.speak(u);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function stopSpeak() {
  if (ttsAvailable()) try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

function tone(freq, t0, dur, type = 'sine', gain = 0.12) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + t0);
  o.stop(ctx.currentTime + t0 + dur + 0.02);
}

// 周波数スイープ(キュイン=当確音の文法)
function sweep(f0, f1, t0, dur, type = 'sawtooth', gain = 0.1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, ctx.currentTime + t0);
  o.frequency.exponentialRampToValueAtTime(f1, ctx.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + t0);
  o.stop(ctx.currentTime + t0 + dur + 0.02);
}

// ホワイトノイズ(払い出しの「シャラ」)
function noiseBurst(t0, dur, gain = 0.05) {
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + t0);
}

// コンボ音階(ペンタトニック上昇 — 連打が音楽になる。切れると階段が下に戻る)
const SCALE = [523, 587, 659, 784, 880, 1046, 1175, 1318, 1568];
export function comboTone(combo) {
  if (!ctx || ctx.state !== 'running') return;
  try {
    const idx = Math.min(Math.floor(combo / 3), SCALE.length - 1);
    tone(SCALE[idx], 0, 0.05, 'triangle', 0.05);
    if (combo > 0 && combo % 5 === 0) tone(SCALE[idx] * 1.5, 0.02, 0.07, 'triangle', 0.04);
  } catch (e) { /* ignore */ }
}

export function sfx(name) {
  if (!ctx) return;
  if (ctx.state !== 'running') { ctx.resume().catch(() => {}); return; }
  try {
    switch (name) {
      case 'ok':
        tone(660, 0, 0.1, 'triangle');
        tone(990, 0.07, 0.14, 'triangle');
        break;
      case 'crit':
        tone(523, 0, 0.09, 'square', 0.08);
        tone(784, 0.07, 0.09, 'square', 0.08);
        tone(1046, 0.14, 0.2, 'triangle', 0.14);
        tone(1568, 0.22, 0.25, 'triangle', 0.1);
        break;
      case 'bad':
        tone(220, 0, 0.18, 'sawtooth', 0.07);
        tone(165, 0.1, 0.25, 'sawtooth', 0.07);
        break;
      case 'tick':
        tone(880, 0, 0.04, 'square', 0.04);
        break;
      case 'flip':
        tone(440, 0, 0.06, 'triangle', 0.06);
        tone(587, 0.05, 0.08, 'triangle', 0.06);
        break;
      case 'fanfare':
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.12));
        break;
      case 'lose':
        [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.12, 0.2, 'sine', 0.1));
        break;
      case 'open':
        tone(392, 0, 0.1, 'triangle');
        tone(523, 0.09, 0.1, 'triangle');
        tone(659, 0.18, 0.1, 'triangle');
        tone(1046, 0.27, 0.35, 'triangle', 0.15);
        break;
      case 'kyuin': // ラッシュ突入(当確音の文法)
        sweep(300, 1760, 0, 0.22, 'sawtooth', 0.11);
        tone(1760, 0.2, 0.35, 'triangle', 0.08);
        break;
      case 'reach': // ゲージ満タン・とどめ詠唱
        tone(740, 0, 0.08, 'triangle', 0.08);
        tone(988, 0.09, 0.08, 'triangle', 0.08);
        tone(740, 0.18, 0.08, 'triangle', 0.08);
        tone(988, 0.27, 0.12, 'triangle', 0.09);
        tone(98, 0, 0.5, 'sawtooth', 0.04);
        break;
      case 'payout': // 払い出しジャラジャラ
        for (let i = 0; i < 10; i++) tone(i % 2 ? 1318 : 1046, i * 0.03, 0.025, 'square', 0.045);
        noiseBurst(0, 0.28, 0.04);
        break;
      case 'promote':
        tone(392, 0, 0.1, 'triangle', 0.09);
        tone(523, 0.1, 0.1, 'triangle', 0.09);
        tone(659, 0.2, 0.14, 'triangle', 0.1);
        break;
      case 'zawa': // 不穏(ボス・接近)
        for (let i = 0; i < 8; i++) tone(110, i * 0.055, 0.05, 'sawtooth', 0.035);
        break;
      case 'land': // ラッシュ終了の着地音(残念音ではない)
        tone(1046, 0, 0.1, 'triangle', 0.07);
        tone(784, 0.1, 0.16, 'triangle', 0.07);
        break;
      case 'hit': // 被弾
        tone(150, 0, 0.12, 'sawtooth', 0.09);
        noiseBurst(0, 0.1, 0.05);
        break;
    }
  } catch (e) { /* ignore */ }
}
