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

if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

initUI(app);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js')
    .then((reg) => { reg.update().catch(() => {}); })
    .catch(() => {});
}

window.addEventListener('error', (e) => console.error(e));
window.addEventListener('beforeunload', () => app.save());

window.__app = app;
window.__toast = toast;
