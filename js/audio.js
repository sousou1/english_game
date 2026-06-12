// 効果音(WebAudio)と読み上げ(speechSynthesis)。
// どちらもユーザー操作後に初期化が必要(特にiOS)。

let ctx = null;
let voice = null;
let voiceLoaded = false;

export function initAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { /* 音なしでも遊べる */ }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
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
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    if (voice) u.voice = voice;
    u.rate = rate;
    u.pitch = 1;
    speechSynthesis.speak(u);
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

export function sfx(name) {
  if (!ctx || ctx.state !== 'running') return;
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
    }
  } catch (e) { /* ignore */ }
}
