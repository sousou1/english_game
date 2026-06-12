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
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => { reg.update().catch(() => {}); })
    .catch(() => {});
  let swSwapped = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swSwapped) return;
    swSwapped = true;
    toast('✨ 新しいバージョンを準備した — 次回起動で適用');
  });
}

window.addEventListener('error', (e) => {
  console.error(e);
});

// デバッグ用
window.__app = app;
window.__toast = toast;
