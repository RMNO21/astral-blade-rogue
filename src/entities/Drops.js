export class DropItem {
  constructor(x, y, type = 'xp', value = 10) {
    this.x = x;
    this.y = y;
    this.type = type; // 'xp', 'quantum', 'heal', 'bomb', 'magnet'
    this.value = value;
    this.radius = type === 'quantum' ? 8 : (type === 'xp' ? 6 : 10);
    this.active = true;
    this.vx = (Math.random() - 0.5) * 80;
    this.vy = (Math.random() - 0.5) * 80;
    this.life = 35.0; // 35 seconds before despawn
    this.pulse = Math.random() * Math.PI * 2;

    // Color by type
    switch (type) {
      case 'xp':
        this.color = value > 25 ? '#a855f7' : (value > 10 ? '#00f0ff' : '#10b981');
        break;
      case 'quantum':
        this.color = '#ffb703';
        break;
      case 'heal':
        this.color = '#ff007f';
        break;
      case 'bomb':
        this.color = '#ef4444';
        break;
      case 'magnet':
        this.color = '#3b82f6';
        break;
      default:
        this.color = '#00f0ff';
    }
  }

  update(dt, blade, magnetRadius = 120, isPinchAttracting = false) {
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    this.pulse += dt * 4;

    // Friction for initial burst velocity
    this.vx *= Math.pow(0.92, dt * 60);
    this.vy *= Math.pow(0.92, dt * 60);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Magnetic pull towards blade
    const distToBlade = Math.hypot(blade.pixelX - this.x, blade.pixelY - this.y);
    const effectiveRadius = isPinchAttracting ? magnetRadius * 3.5 : magnetRadius;

    if (distToBlade < effectiveRadius) {
      const angle = Math.atan2(blade.pixelY - this.y, blade.pixelX - this.x);
      const pullStrength = Math.min(950, (1.0 - (distToBlade / effectiveRadius)) * 800 + 250);
      this.x += Math.cos(angle) * pullStrength * dt;
      this.y += Math.sin(angle) * pullStrength * dt;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;

    const r = this.radius + Math.sin(this.pulse) * 1.5;

    ctx.beginPath();
    if (this.type === 'xp' || this.type === 'quantum') {
      // Diamond shape
      ctx.moveTo(this.x, this.y - r * 1.2);
      ctx.lineTo(this.x + r, this.y);
      ctx.lineTo(this.x, this.y + r * 1.2);
      ctx.lineTo(this.x - r, this.y);
      ctx.closePath();
    } else {
      // Circle with pulsing outer ring
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    }
    ctx.fill();

    // Hot center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
