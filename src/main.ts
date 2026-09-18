import './styles/global.css';
import './styles/auth.css';
import './styles/lobby.css';
import './styles/hud.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/app';

const updateSW = registerSW({
  onNeedRefresh() {
    const bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.innerHTML = '<span>A new version of PetRift is ready.</span><button>Reload</button>';
    bar.querySelector('button')?.addEventListener('click', () => updateSW(true));
    document.body.appendChild(bar);
  },
  onOfflineReady() {
    document.body.classList.add('offline-ready');
  }
});

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app root element');

const app = new App(root);
void app.boot();

const setViewport = () => {
  document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
};
setViewport();
window.addEventListener('resize', setViewport);
window.addEventListener('orientationchange', setViewport);

document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
