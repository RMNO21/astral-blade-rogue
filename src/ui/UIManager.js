export class UIManager {
  constructor(game) {
    this.game = game;

    // Screens
    this.screenMenu = document.getElementById('screen-menu');
    this.screenGameOver = document.getElementById('screen-game-over');
    this.hud = document.getElementById('hud');

    // Hand Cursor
    this.handCursorEl = document.getElementById('hand-cursor');
    this.cursorProgressBar = document.getElementById('cursor-progress-bar');
    this.cursorLabel = document.getElementById('cursor-label');

    this.hoverTarget = null;
    this.hoverTime = 0;
    this.dwellRequired = 0.65;
    this.clickCooldown = 0;
    this.prevPinching = false;

    // HUD Elements
    this.healthFill = document.getElementById('hud-health-fill');
    this.healthText = document.getElementById('hud-health-text');
    this.pulseStatus = document.getElementById('hud-pulse-status');
    this.scoreVal = document.getElementById('hud-score-val');
    this.highscoreVal = document.getElementById('hud-highscore-val');
    this.timeVal = document.getElementById('hud-time-val');
    this.diffVal = document.getElementById('hud-diff-val');
    this.trackingBadge = document.getElementById('hud-tracking-badge');

    this.setupListeners();
    this.bindGameEvents();
  }

  setupListeners() {
    // Start button
    document.getElementById('btn-start-game')?.addEventListener('click', async () => {
      this.game.audio.init();
      this.game.audio.resume();

      if (!this.game.handTracker.isCameraActive) {
        await this.game.handTracker.startWebcam();
      }
      this.startGame();
    });

    // Retry button
    document.getElementById('btn-retry-run')?.addEventListener('click', () => {
      this.startGame();
    });

    // Toggle Camera / Mouse
    document.getElementById('btn-toggle-input')?.addEventListener('click', async () => {
      if (this.game.handTracker.isCameraActive) {
        this.game.handTracker.stopWebcam();
      } else {
        await this.game.handTracker.startWebcam();
      }
    });

    // Fullscreen
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  bindGameEvents() {
    this.game.setUICallbacks({
      onRunStart: () => {
        this.screenMenu.classList.add('hidden');
        this.screenGameOver.classList.add('hidden');
        this.hud.classList.remove('hidden');
      },
      onHUDUpdate: (game) => this.updateHUD(game),
      onGameOver: (game) => this.showGameOver(game)
    });

    this.game.handTracker.callbacks.onTrackingStatus = (status) => {
      this.updateTrackingBadge(status);
    };
  }

  startGame() {
    this.screenMenu.classList.add('hidden');
    this.screenGameOver.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.game.startRun();
  }

  updateHandCursor(dt) {
    const state = this.game.handTracker.state;
    if (!this.handCursorEl) return;

    if (this.clickCooldown > 0) {
      this.clickCooldown -= dt;
    }

    const px = state.x * window.innerWidth;
    const py = state.y * window.innerHeight;

    this.handCursorEl.style.transform = `translate(${px}px, ${py}px)`;

    const isUIMode = this.game.state !== 'PLAYING';

    if (!isUIMode) {
      this.handCursorEl.style.display = 'none';
      if (this.hoverTarget) {
        this.hoverTarget.classList.remove('hand-hover');
        this.hoverTarget = null;
      }
      return;
    }

    this.handCursorEl.style.display = 'flex';

    const elUnder = document.elementFromPoint(px, py);
    const clickable = elUnder?.closest('button, .menu-btn');

    if (clickable && !clickable.disabled) {
      if (this.hoverTarget !== clickable) {
        if (this.hoverTarget) this.hoverTarget.classList.remove('hand-hover');
        this.hoverTarget = clickable;
        this.hoverTarget.classList.add('hand-hover');
        this.hoverTime = 0;
      }

      this.hoverTime += dt;
      const progressPct = Math.min(100, (this.hoverTime / this.dwellRequired) * 100);
      if (this.cursorProgressBar) {
        this.cursorProgressBar.setAttribute('stroke-dasharray', `${progressPct}, 100`);
      }
      if (this.cursorLabel) {
        this.cursorLabel.textContent = state.isPinching ? '⚡ پینچ' : 'نگه‌داشتن برای انتخاب';
      }

      // Dwell Click
      if (this.hoverTime >= this.dwellRequired && this.clickCooldown <= 0) {
        this.triggerClick(clickable);
      }

      // Pinch Click
      const justPinched = state.isPinching && !this.prevPinching;
      if (justPinched && this.clickCooldown <= 0) {
        this.triggerClick(clickable);
      }
    } else {
      if (this.hoverTarget) {
        this.hoverTarget.classList.remove('hand-hover');
        this.hoverTarget = null;
      }
      this.hoverTime = 0;
      if (this.cursorProgressBar) {
        this.cursorProgressBar.setAttribute('stroke-dasharray', '0, 100');
      }
      if (this.cursorLabel) {
        this.cursorLabel.textContent = '';
      }
    }

    this.prevPinching = state.isPinching;
  }

  triggerClick(target) {
    this.clickCooldown = 0.5;
    this.hoverTime = 0;
    if (this.cursorProgressBar) {
      this.cursorProgressBar.setAttribute('stroke-dasharray', '0, 100');
    }
    this.game.audio.playClick();
    target.click();

    target.classList.remove('hand-hover');
    setTimeout(() => {
      if (this.hoverTarget === target) target.classList.add('hand-hover');
    }, 150);
  }

  updateHUD(game) {
    // Health bar
    const hpPct = Math.max(0, (game.health / game.maxHealth) * 100);
    this.healthFill.style.width = `${hpPct}%`;
    this.healthText.textContent = `${Math.round(game.health)} HP`;

    // Dynamic Pulse Status Feedback
    if (game.blade.isFrozen) {
      const charge = Math.round(game.blade.getChargeProgress() * 100);
      const dur = game.blade.getCurrentChargeDuration();
      if (game.blade.consecutivePulses === 0) {
        this.pulseStatus.textContent = `⚡ شارژ سریع (${dur}s): ${charge}%`;
        this.pulseStatus.style.color = '#00f0ff';
      } else {
        this.pulseStatus.textContent = `🔥 پالس متوالی (${dur}s) • شارژ سنگین! (${charge}%)`;
        this.pulseStatus.style.color = '#ef4444';
      }
    } else {
      if (game.blade.consecutivePulses > 0) {
        const remain = game.blade.getRemainingCooldown().toFixed(1);
        this.pulseStatus.textContent = `🏃 در حال فرار • خنک‌سازی تا پالس سریع: ${remain}s`;
        this.pulseStatus.style.color = '#ffb703';
      } else {
        this.pulseStatus.textContent = '🖐️ دست باز • پالس سریع آماده (۰.۳۵s)';
        this.pulseStatus.style.color = '#10b981';
      }
    }

    // Score & Highscore
    this.scoreVal.textContent = Math.round(game.score).toLocaleString();
    this.highscoreVal.textContent = Math.round(game.highScore).toLocaleString();

    // Time Survived (MM:SS)
    const totalSec = Math.floor(game.timeSurvived);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    this.timeVal.textContent = `${m}:${s}`;

    // Difficulty
    this.diffVal.textContent = `${game.difficultyMultiplier.toFixed(1)}x`;
  }

  showGameOver(game) {
    this.hud.classList.add('hidden');
    this.screenGameOver.classList.remove('hidden');

    document.getElementById('summary-score').textContent = Math.round(game.score).toLocaleString();
    document.getElementById('summary-highscore').textContent = Math.round(game.highScore).toLocaleString();

    const totalSec = Math.floor(game.timeSurvived);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    document.getElementById('summary-time').textContent = `${m} دقیقه و ${s} ثانیه`;
    document.getElementById('summary-kills').textContent = game.enemiesKilled.toLocaleString();
  }

  updateTrackingBadge(status) {
    if (!this.trackingBadge) return;
    switch (status) {
      case 'hand_tracked':
        this.trackingBadge.textContent = '● دست متصل شد';
        this.trackingBadge.className = 'badge-tracked';
        break;
      case 'hand_lost':
        this.trackingBadge.textContent = '○ در جستجوی دست...';
        this.trackingBadge.className = 'badge-searching';
        break;
      case 'camera_active':
        this.trackingBadge.textContent = '● دوربین فعال';
        this.trackingBadge.className = 'badge-tracked';
        break;
      case 'mouse_mode':
        this.trackingBadge.textContent = '🖱️ حالت ماوس';
        this.trackingBadge.className = 'badge-mouse';
        break;
      default:
        this.trackingBadge.textContent = '● راه‌اندازی...';
        this.trackingBadge.className = 'badge-searching';
    }
  }
}
