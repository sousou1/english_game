import { WORDS } from '../data/words.js';
import { buildIndex } from './quiz.js';
import { loadProfile, saveProfile } from './storage.js';
import { initUI, toast } from './ui.js';

const app = {
  words: WORDS,
  index: buildIndex(WORDS),
  profile: loadProfile(),
  save() { saveProfile(this.profile); },
};

// ブラウザによるストレージ削除を抑止(ベストエフォート)
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

initUI(app);

// PWA
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

window.addEventListener('error', (e) => {
  console.error(e);
});

// デバッグ用
window.__app = app;
window.__toast = toast;
