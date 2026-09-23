export class Projectile {
  constructor(x, y, vx, vy, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = options.radius || 6;
    this.color = options.color || '#ff0055';
    this.damage = options.damage || 15;
    this.isDeflected = options.isDeflected || false;
    this.isHoming = options.isHoming || false;
    this.homingTarget = null;
    this.life = options.life || 6.0;
    this.active = true;
    this.tail = [];
    this.tailLength = 6;
  }

  update(dt, screenW, screenH, enemies = []) {
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    // Save trail
    this.tail.unshift({ x: this.x, y: this.y });
    if (this.tail.length > this.tailLength) {
      this.tail.pop();
    }

    // Homing behavior for deflected or player missiles
    if (this.isDeflected && this.isHoming && enemies.length > 0) {
      if (!this.homingTarget || !this.homingTarget.active) {
        let nearest = null;
        let minDist = Infinity;
        for (const e of enemies) {
          if (e.active) {
            const d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < minDist) {
              minDist = d;
              nearest = e;
            }
          }
        }
        this.homingTarget = nearest;
      }

      if (this.homingTarget) {
        const angle = Math.atan2(this.homingTarget.y - this.y, this.homingTarget.x - this.x);
        const curAngle = Math.atan2(this.vy, this.vx);
        let diff = angle - curAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const newAngle = curAngle + Math.sign(diff) * Math.min(Math.abs(diff), dt * 6.0);
        const speed = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(newAngle) * speed;
        this.vy = Math.sin(newAngle) * speed;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Boundary check (extra margin)
    if (this.x < -60 || this.x > screenW + 60 || this.y < -60 || this.y > screenH + 60) {
      this.active = false;
    }
  }

  deflect(blade) {
    if (this.isDeflected) return;
    this.isDeflected = true;
    this.color = '#00f0ff';
    this.damage *= blade.deflectMultiplier;
    this.isHoming = true;

    // Calculate bounce direction away from blade movement
    const spd = Math.hypot(this.vx, this.vy) * 1.35;
    const slashAngle = Math.atan2(blade.pixelY - blade.prevPixelY, blade.pixelX - blade.prevPixelX);
    this.vx = Math.cos(slashAngle) * spd;
    this.vy = Math.sin(slashAngle) * spd;
  }

  draw(ctx) {
    ctx.save();
    // Trail
    if (this.tail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      for (let i = 0; i < this.tail.length; i++) {
        ctx.lineTo(this.tail[i].x, this.tail[i].y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.radius * 1.2;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
    }

    // Core
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = this.isDeflected ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
