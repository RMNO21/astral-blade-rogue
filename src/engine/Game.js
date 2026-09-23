import { Blade } from '../entities/Blade.js';
import { ParticlePool } from '../entities/Particle.js';
import { ArrowEnemy } from '../entities/Enemy.js';

export class Game {
  constructor(canvas, renderer, audio, handTracker) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.audio = audio;
    this.handTracker = handTracker;

    this.state = 'MENU'; // 'MENU', 'PLAYING', 'GAME_OVER'

    this.blade = new Blade();
    this.particles = new ParticlePool(400);

    this.enemies = [];
    this.projectiles = [];
    this.drops = [];

    // Health system
    this.maxHealth = 100;
    this.health = 100;
    this.invincibleTimer = 0;

    // Endless Score & Difficulty Progression
    this.score = 0;
    this.highScore = 0;
    this.timeSurvived = 0;
    this.enemiesKilled = 0;
    this.difficultyMultiplier = 1.0;
    this.spawnTimer = 0;

    this.loadHighScore();

    this.uiCallbacks = {};
    this.bindHandTracker();
  }

  loadHighScore() {
    try {
      const saved = localStorage.getItem('astral_endless_highscore');
      if (saved) {
        this.highScore = parseInt(saved, 10) || 0;
      }
    } catch (e) {
      console.warn('Could not read highscore from localStorage:', e);
    }
  }

  saveHighScore() {
    try {
      if (this.score > this.highScore) {
        this.highScore = Math.round(this.score);
        localStorage.setItem('astral_endless_highscore', this.highScore.toString());
      }
    } catch (e) {
      console.warn('Could not save highscore to localStorage:', e);
    }
  }

  setUICallbacks(callbacks) {
    this.uiCallbacks = callbacks;
  }

  bindHandTracker() {
    this.handTracker.callbacks.onStateUpdate = (state) => {
      // Coordinates are processed in main loop
    };
  }

  startRun() {
    this.state = 'PLAYING';
    this.enemies = [];
    this.projectiles = [];
    this.drops = [];
    this.particles.clear();

    this.blade = new Blade();
    this.health = this.maxHealth;
    this.invincibleTimer = 0;

    this.score = 0;
    this.timeSurvived = 0;
    this.enemiesKilled = 0;
    this.difficultyMultiplier = 1.0;
    this.spawnTimer = 0.5;

    this.audio.startBGM();

    if (this.uiCallbacks.onRunStart) {
      this.uiCallbacks.onRunStart();
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') {
      return;
    }

    this.timeSurvived += dt;
    this.score += dt * 15; // Passive survival score

    // Endless Difficulty Scaling (Progressive increase rate cut in half again)
    this.difficultyMultiplier = 1.0 + (this.timeSurvived / 72.0);

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }

    // 1. Update Player Blade
    // Freezes when hand is closed; triggers pulse after hold
    const triggeredPulse = this.blade.update(
      this.handTracker.state,
      dt,
      this.renderer.width,
      this.renderer.height
    );

    if (triggeredPulse) {
      this.triggerShockwavePulse();
    }

    // Continuous collision check for expanding shockwave rings
    if (this.blade.activeShockwaves.length > 0) {
      for (const sw of this.blade.activeShockwaves) {
        // Vaporize any enemy touched by expanding shockwave
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const enemy = this.enemies[i];
          if (enemy.active) {
            const d = Math.hypot(enemy.x - sw.x, enemy.y - sw.y);
            if (d <= (sw.radius + enemy.radius + 25)) {
              enemy.takeDamage(100);
              this.audio.playSliceHit(true);
              this.particles.emitSparks(enemy.x, enemy.y, 20, '#ffb703', 360);
              this.particles.emitDamageText(enemy.x, enemy.y, 100, true, 'PULSE KILL!');
              this.onEnemyKilled(enemy);
              this.enemies.splice(i, 1);
            }
          }
        }
        // Deflect any projectile touched by expanding wave
        for (const proj of this.projectiles) {
          if (!proj.isDeflected) {
            const d = Math.hypot(proj.x - sw.x, proj.y - sw.y);
            if (d <= (sw.radius + 25)) {
              proj.deflect(this.blade);
            }
          }
        }
      }
    }

    // Cooldown reset feedback after 1 second
    if (this.blade.justCooledDown) {
      this.audio.playGemCollect();
      this.particles.emitSparks(this.blade.pixelX, this.blade.pixelY, 16, '#00f0ff', 250, 3);
      this.renderer.showNotification('⚡ پالس سریع آماده شد! (۰.۳۵ ثانیه)', '#00f0ff', 1.0);
    }

    // Audio hum on charging
    if (this.blade.isFrozen && this.blade.chargeTimer > 0 && Math.random() < 0.25) {
      this.audio.playNovaCharge(this.blade.getChargeProgress());
    }

    // 2. Spawn Arrow Enemies (extra relaxed scaling)
    this.spawnTimer -= dt;
    const spawnInterval = Math.max(0.85, 2.8 / Math.sqrt(this.difficultyMultiplier));
    if (this.spawnTimer <= 0) {
      this.spawnArrowEnemy();
      this.spawnTimer = spawnInterval;
    }

    // 3. Update Enemies
    this.updateEnemies(dt);

    // 4. Update Projectiles
    this.updateProjectiles(dt);

    // 5. Update Particles & Renderer
    this.particles.update(dt);
    this.renderer.update(dt);

    // 6. Update HUD
    if (this.uiCallbacks.onHUDUpdate) {
      this.uiCallbacks.onHUDUpdate(this);
    }
  }

  spawnArrowEnemy() {
    const w = this.renderer.width;
    const h = this.renderer.height;

    // Spawn around outer border edges
    let x, y;
    const edge = Math.floor(Math.random() * 3); // 0 = top, 1 = left, 2 = right
    if (edge === 0) {
      x = Math.random() * w;
      y = -30;
    } else if (edge === 1) {
      x = -30;
      y = Math.random() * (h * 0.6);
    } else {
      x = w + 30;
      y = Math.random() * (h * 0.6);
    }

    this.enemies.push(new ArrowEnemy(x, y, this.difficultyMultiplier));
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(
        dt,
        this.blade.pixelX,
        this.blade.pixelY,
        this.projectiles,
        this.renderer.width,
        this.renderer.height,
        this.difficultyMultiplier
      );

      if (!enemy.active) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Check physical collision with player
      const dist = Math.hypot(enemy.x - this.blade.pixelX, enemy.y - this.blade.pixelY);
      if (dist <= (enemy.radius + this.blade.hitRadius)) {
        // Direct crash deals heavy damage
        this.takeDamage(40);
        enemy.active = false;
        this.particles.emitShockwave(enemy.x, enemy.y, '#ef4444', 60);
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.update(dt, this.renderer.width, this.renderer.height, this.enemies);

      if (!proj.active) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (proj.isDeflected) {
        // Deflected bullet hitting enemy
        for (const enemy of this.enemies) {
          if (enemy.active && Math.hypot(enemy.x - proj.x, enemy.y - proj.y) <= (enemy.radius + proj.radius)) {
            enemy.takeDamage(proj.damage);
            this.audio.playSliceHit(true);
            this.particles.emitSparks(enemy.x, enemy.y, 14, '#00f0ff', 320);
            this.particles.emitDamageText(enemy.x, enemy.y, proj.damage, true);
            proj.active = false;
            if (!enemy.active) {
              this.onEnemyKilled(enemy);
            }
            break;
          }
        }
      } else {
        // Enemy bullet hitting player
        const dist = Math.hypot(proj.x - this.blade.pixelX, proj.y - this.blade.pixelY);
        if (dist <= (proj.radius + this.blade.hitRadius * 0.7)) {
          this.takeDamage(proj.damage);
          proj.active = false;
        }
      }
    }
  }

  // The 1-Second Shockwave Pulse Mechanic
  triggerShockwavePulse() {
    this.audio.playNovaExplosion();
    this.renderer.addScreenShake(14);
    this.renderer.showNotification('⚡ SHOCKWAVE PULSE! ⚡', '#00f0ff', 1.0);

    const pulseR = this.blade.pulseRadius; // 380px

    // 1. Deflect all incoming enemy bullets within pulse radius
    let deflectedCount = 0;
    for (const proj of this.projectiles) {
      if (!proj.isDeflected) {
        const d = Math.hypot(proj.x - this.blade.pixelX, proj.y - this.blade.pixelY);
        if (d <= pulseR + 40) {
          proj.deflect(this.blade);
          deflectedCount++;
        }
      }
    }
    if (deflectedCount > 0) {
      this.audio.playDeflect();
      this.score += deflectedCount * 50;
    }

    // 2. Vaporize all enemies within pulse radius immediately
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.active) {
        const d = Math.hypot(enemy.x - this.blade.pixelX, enemy.y - this.blade.pixelY);
        if (d <= pulseR + enemy.radius + 30) {
          enemy.takeDamage(100);
          this.audio.playSliceHit(true);
          this.particles.emitSparks(enemy.x, enemy.y, 22, '#ffb703', 380);
          this.particles.emitDamageText(enemy.x, enemy.y, 100, true, 'PULSE KILL!');
          this.onEnemyKilled(enemy);
          this.enemies.splice(i, 1);
        }
      }
    }
  }

  onEnemyKilled(enemy) {
    this.enemiesKilled++;
    this.score += 100 * this.difficultyMultiplier;
    this.particles.emitShockwave(enemy.x, enemy.y, '#ff0055', enemy.radius * 2.2);
  }

  takeDamage(amount) {
    if (this.invincibleTimer > 0) return;

    this.health -= amount;
    this.invincibleTimer = 1.0; // 1 second i-frames
    this.audio.playPlayerHurt();
    this.renderer.addScreenShake(16);

    if (this.health <= 0) {
      this.health = 0;
      this.onGameOver();
    }
  }

  onGameOver() {
    this.state = 'GAME_OVER';
    this.audio.stopBGM();
    this.saveHighScore();

    if (this.uiCallbacks.onGameOver) {
      this.uiCallbacks.onGameOver(this);
    }
  }
}
