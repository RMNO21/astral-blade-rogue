import { Enemy } from './Enemy.js';
import { Projectile } from './Projectile.js';

export class Boss extends Enemy {
  constructor(x, y, type = 'colossus') {
    super(x, y, {
      hp: type === 'colossus' ? 850 : 1200,
      radius: 54,
      color: '#ec4899',
      scoreValue: 2500,
      xpValue: 300,
      quantumValue: 25
    });

    this.bossType = type;
    this.isBoss = true;
    this.name = type === 'colossus' ? 'AEGIS COLOSSUS' : 'CHRONO OVERLORD';
    this.phase = 1;
    this.attackTimer = 2.0;
    this.patternStep = 0;

    // Colossus rotating shield nodes
    this.shieldNodes = 4;
    this.shieldRotation = 0;
  }

  update(dt, screenW, screenH, blade, projectiles) {
    this.shieldRotation += dt * 1.8;

    // Float at upper third of arena
    const targetY = screenH * 0.22;
    this.y += (targetY - this.y) * dt * 2.0;
    this.x += Math.sin(performance.now() * 0.0012) * 120 * dt;

    // Check phase transition
    if (this.phase === 1 && this.hp < this.maxHp * 0.5) {
      this.phase = 2;
      this.color = '#ef4444';
    }

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.executeAttack(screenW, screenH, blade, projectiles);
      this.attackTimer = this.phase === 2 ? 1.4 : 2.2;
    }

    super.update(dt, screenW, screenH, blade, projectiles);
  }

  executeAttack(screenW, screenH, blade, projectiles) {
    this.patternStep++;

    if (this.bossType === 'colossus') {
      if (this.patternStep % 2 === 0) {
        // Radial bullet ring
        const count = this.phase === 2 ? 16 : 10;
        const spd = 210;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + (this.patternStep * 0.2);
          projectiles.push(new Projectile(
            this.x, this.y,
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            { color: '#f43f5e', radius: 7, damage: 15 }
          ));
        }
      } else {
        // Aimed triple burst at blade cursor
        const baseAngle = Math.atan2(blade.pixelY - this.y, blade.pixelX - this.x);
        const spreads = [-0.25, 0, 0.25];
        for (const spr of spreads) {
          projectiles.push(new Projectile(
            this.x, this.y,
            Math.cos(baseAngle + spr) * 280,
            Math.sin(baseAngle + spr) * 280,
            { color: '#fbbf24', radius: 8, damage: 20 }
          ));
        }
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const isFlashing = this.hitFlashTimer > 0;
    ctx.fillStyle = isFlashing ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 24;

    // Massive boss central core
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner mechanical ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // Eye / Reactor center
    ctx.fillStyle = this.phase === 2 ? '#ff0055' : '#38bdf8';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Draw orbiting shield nodes
    const nodeOrbitR = this.radius + 26;
    for (let i = 0; i < this.shieldNodes; i++) {
      const a = this.shieldRotation + (i * (Math.PI * 2 / this.shieldNodes));
      const nx = Math.cos(a) * nodeOrbitR;
      const ny = Math.sin(a) * nodeOrbitR;

      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(nx, ny, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
