import { AudioEngine } from './engine/AudioEngine.js';
import { HandTracker } from './engine/HandTracker.js';
import { Renderer } from './engine/Renderer.js';
import { Game } from './engine/Game.js';
import { UIManager } from './ui/UIManager.js';

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('game-canvas');
  const pipCanvas = document.getElementById('pip-canvas');
  const videoElement = document.getElementById('webcam-video');

  const audio = new AudioEngine();
  const handTracker = new HandTracker();
  const renderer = new Renderer(canvas);
  const game = new Game(canvas, renderer, audio, handTracker);
  const ui = new UIManager(game);

  // Initialize hand tracker and PIP canvas
  await handTracker.init(videoElement, pipCanvas);

  // Auto-prompt camera start when user clicks "Play" or "Start Camera"
  const startCameraBtn = document.getElementById('btn-start-camera');
  if (startCameraBtn) {
    startCameraBtn.addEventListener('click', async () => {
      audio.init();
      audio.resume();
      const ok = await handTracker.startWebcam();
      if (ok) {
        startCameraBtn.textContent = '📸 WEBCAM ACTIVE (MIRRORED)';
        startCameraBtn.classList.add('active');
      }
    });
  }

  // Toggle PIP preview expand/collapse
  const pipContainer = document.getElementById('webcam-pip');
  const pipToggle = document.getElementById('pip-toggle');
  if (pipToggle && pipContainer) {
    pipToggle.addEventListener('click', () => {
      pipContainer.classList.toggle('collapsed');
      pipToggle.textContent = pipContainer.classList.contains('collapsed') ? '➕' : '➖';
    });
  }

  // Audio unlock on user touch/click anywhere
  const unlockAudio = () => {
    audio.init();
    audio.resume();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Main 60-144fps Game Loop
  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // prevent spiral of death
    lastTime = now;

    // Update Hand Cursor in menus and UI
    ui.updateHandCursor(dt);

    game.update(dt);
    renderer.render(game);

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
  console.log('Astral Blade: Rogue Cosmos with Hand Menu Navigation initialized!');
});
