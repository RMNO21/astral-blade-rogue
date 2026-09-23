export class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.color = '#00f0ff';
    this.size = 3;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.alpha = 1.0;
    this.drag = 0.96;
    this.gravity = 0;
    this.type = 'spark'; // 'spark', 'shard', 'shockwave', 'text'
    this.text = '';
    this.fontSize = 16;
    this.radius = 0;
    this.maxRadius = 50;
  }

  spawnSpark(x, y, vx, vy, color, size = 3, life = 0.6) {
    this.active = true;
    this.type = 'spark';
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.alpha = 1.0;
    this.drag = 0.94;
    this.gravity = 0;
  }

  spawnShockwave(x, y, color, maxRadius = 120, life = 0.5) {
    this.active = true;
    this.type = 'shockwave';
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.color = color;
    this.radius = 4;
    this.maxRadius = maxRadius;
    this.life = life;
    this.maxLife = life;
    this.alpha = 1.0;
  }

  spawnText(x, y, text, color = '#ffffff', fontSize = 18, isCrit = false) {
    this.active = true;
    this.type = 'text';
    this.x = x + (Math.random() * 20 - 10);
    this.y = y;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = isCrit ? -110 : -75;
    this.text = text;
    this.color = color;
    this.fontSize = isCrit ? fontSize * 1.3 : fontSize;
    this.life = isCrit ? 0.9 : 0.65;
    this.maxLife = this.life;
    this.alpha = 1.0;
    this.drag = 0.98;
    this.gravity = 40;
  }

  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    this.alpha = Math.max(0, this.life / this.maxLife);

    if (this.type === 'shockwave') {
      const progress = 1.0 - (this.life / this.maxLife);
      this.radius = 5 + progress * (this.maxRadius - 5);
      return;
    }

    this.vx *= Math.pow(this.drag, dt * 60);
    this.vy *= Math.pow(this.drag, dt * 60);
    this.vy += this.gravity * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    if (!this.active) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;

    if (this.type === 'spark') {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * this.alpha, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'shockwave') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, 4 * this.alpha);
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'text') {
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.font = `bold ${Math.round(this.fontSize)}px Rajdhani, Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(this.text, this.x, this.y);
    }

    ctx.restore();
  }
}

export class ParticlePool {
  constructor(size = 400) {
    this.pool = Array.from({ length: size }, () => new Particle());
  }

  getParticle() {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) return this.pool[i];
    }
    // Expand if needed
    const p = new Particle();
    this.pool.push(p);
    return p;
  }

  emitSparks(x, y, count = 12, color = '#00f0ff', speed = 240, size = 3) {
    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      p.spawnSpark(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        size + Math.random() * 2,
        0.35 + Math.random() * 0.35
      );
    }
  }

  emitSlashBurst(x, y, slashAngle, color = '#00f0ff', count = 15) {
    for (let i = 0; i < count; i++) {
      const p = this.getParticle();
      // Fan out perpendicular to slash angle
      const spread = (Math.random() - 0.5) * 1.2;
      const angle = slashAngle + (Math.PI / 2) + spread;
      const spd = 120 + Math.random() * 320;
      p.spawnSpark(
        x, y,
        Math.cos(angle) * spd,
        Math.sin(angle) * spd,
        color,
        2.5 + Math.random() * 2,
        0.3 + Math.random() * 0.4
      );
    }
  }

  emitShockwave(x, y, color = '#ff007f', maxRadius = 160) {
    const p = this.getParticle();
    p.spawnShockwave(x, y, color, maxRadius, 0.45);
  }

  emitDamageText(x, y, damage, isCrit = false, customText = null) {
    const p = this.getParticle();
    const text = customText || (isCrit ? `CRIT ${Math.round(damage)}!` : `${Math.round(damage)}`);
    const color = isCrit ? '#ffb703' : '#ffffff';
    p.spawnText(x, y, text, color, isCrit ? 22 : 16, isCrit);
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt);
      }
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].draw(ctx);
      }
    }
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}
