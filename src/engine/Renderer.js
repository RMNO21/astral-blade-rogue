export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.screenShake = 0;
    this.notifications = [];

    this.stars = [];
    this.initStars();

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.resetTransform();
    this.ctx.scale(this.dpr, this.dpr);
  }

  initStars() {
    this.stars = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: Math.random() < 0.7 ? 1 : (Math.random() < 0.9 ? 2 : 3),
        speed: 20 + Math.random() * 50,
        alpha: 0.3 + Math.random() * 0.7,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  addScreenShake(intensity = 8) {
    this.screenShake = Math.max(this.screenShake, intensity);
  }

  showNotification(text, color = '#00f0ff', duration = 1.2) {
    this.notifications.push({
      text,
      color,
      life: duration,
      maxLife: duration
    });
  }

  update(dt) {
    if (this.screenShake > 0) {
      this.screenShake *= Math.pow(0.85, dt * 60);
      if (this.screenShake < 0.2) this.screenShake = 0;
    }

    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > this.height) {
        star.y = 0;
        star.x = Math.random() * this.width;
      }
      star.twinkle += dt * 3;
    }

    for (let i = this.notifications.length - 1; i >= 0; i--) {
      this.notifications[i].life -= dt;
      if (this.notifications[i].life <= 0) {
        this.notifications.splice(i, 1);
      }
    }
  }

  render(game) {
    const ctx = this.ctx;
    ctx.save();

    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake * 2;
      const shakeY = (Math.random() - 0.5) * this.screenShake * 2;
      ctx.translate(shakeX, shakeY);
    }

    // Deep space background
    ctx.fillStyle = '#060913';
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawStarfield(ctx);

    // Draw Arrow Enemies
    for (const enemy of game.enemies) {
      if (enemy.active) enemy.draw(ctx);
    }

    // Draw Projectiles
    for (const proj of game.projectiles) {
      if (proj.active) proj.draw(ctx);
    }

    // Draw Particles
    game.particles.draw(ctx);

    // Draw Player Character (with freeze, charge ring, and shockwaves)
    game.blade.draw(ctx);

    // Draw Notifications
    this.drawNotifications(ctx);

    ctx.restore();
  }

  drawStarfield(ctx) {
    ctx.save();
    for (const star of this.stars) {
      const twinkleAlpha = star.alpha * (0.7 + Math.sin(star.twinkle) * 0.3);
      ctx.fillStyle = `rgba(255, 255, 255, ${twinkleAlpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawNotifications(ctx) {
    for (const notif of this.notifications) {
      const alpha = Math.min(1.0, notif.life / (notif.maxLife * 0.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '900 24px Orbitron, Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = notif.color;
      ctx.shadowColor = notif.color;
      ctx.shadowBlur = 14;
      ctx.fillText(notif.text, this.width / 2, this.height * 0.35);
      ctx.restore();
    }
  }
}
