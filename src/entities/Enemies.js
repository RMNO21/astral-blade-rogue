import { Enemy } from './Enemy.js';
import { Projectile } from './Projectile.js';

export class Asteroid extends Enemy {
  constructor(x, y, size = 'large') {
    const isLarge = size === 'large';
    super(x, y, {
      hp: isLarge ? 55 : 25,
      radius: isLarge ? 28 : 16,
      color: '#94a3b8',
      scoreValue: isLarge ? 40 : 20,
      xpValue: isLarge ? 15 : 8,
      quantumValue: isLarge ? 2 : 1
    });
    this.size = size;
    this.coreColor = '#cbd5e1';
    this.points = [];
    const numPts = 7;
    for (let i = 0; i < numPts; i++) {
      const a = (i / numPts) * Math.PI * 2;
      const r = this.radius * (0.8 + Math.random() * 0.4);
      this.points.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const isFlashing = this.hitFlashTimer > 0;
    ctx.fillStyle = isFlashing ? '#ffffff' : this.color;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#64748b';
    ctx.shadowBlur = isFlashing ? 14 : 4;

    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    if (this.hp < this.maxHp && this.hp > 0) {
      this.drawHealthBar(ctx);
    }
  }
}

export class Swarmer extends Enemy {
  constructor(x, y) {
    super(x, y, {
      hp: 20,
      radius: 14,
      color: '#ff0055',
      scoreValue: 60,
      xpValue: 10,
      quantumValue: 1
    });
    this.coreColor = '#ffe4e6';
    this.waveOffset = Math.random() * Math.PI * 2;
    this.baseVy = 130;
  }

  update(dt, screenW, screenH, blade, projectiles) {
    this.waveOffset += dt * 5;
    this.vx = Math.sin(this.waveOffset) * 160;
    this.vy = this.baseVy;
    super.update(dt, screenW, screenH, blade, projectiles);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const isFlashing = this.hitFlashTimer > 0;
    ctx.fillStyle = isFlashing ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    // Diamond / Dart shape
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 1.3);
    ctx.lineTo(this.radius, this.radius * 0.8);
    ctx.lineTo(0, this.radius * 0.4);
    ctx.lineTo(-this.radius, this.radius * 0.8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    if (this.hp < this.maxHp && this.hp > 0) {
      this.drawHealthBar(ctx);
    }
  }
}

export class LaserCruiser extends Enemy {
  constructor(x, y) {
    super(x, y, {
      hp: 75,
      radius: 26,
      color: '#8b5cf6',
      scoreValue: 120,
      xpValue: 30,
      quantumValue: 3
    });
    this.shootTimer = 2.0 + Math.random() * 1.5;
    this.isTelegraphing = false;
    this.telegraphTimer = 0;
    this.targetX = 0;
    this.targetY = 0;
  }

  update(dt, screenW, screenH, blade, projectiles) {
    // Moves towards upper third of screen and hovers
    if (this.y < screenH * 0.3) {
      this.vy = 80;
    } else {
      this.vy = Math.sin(performance.now() * 0.002) * 20;
    }

    this.shootTimer -= dt;
    if (this.shootTimer <= 0.8 && !this.isTelegraphing) {
      this.isTelegraphing = true;
      this.targetX = blade.pixelX;
      this.targetY = blade.pixelY;
    }

    if (this.shootTimer <= 0) {
      this.shoot(projectiles);
      this.shootTimer = 3.2;
      this.isTelegraphing = false;
    }

    super.update(dt, screenW, screenH, blade, projectiles);
  }

  shoot(projectiles) {
    const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
    const speed = 260;
    projectiles.push(new Projectile(
      this.x, this.y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      { color: '#ec4899', radius: 7, damage: 18 }
    ));
  }

  draw(ctx) {
    // Draw telegraph laser beam
    if (this.isTelegraphing) {
      ctx.save();
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.targetX, this.targetY);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    const isFlashing = this.hitFlashTimer > 0;
    ctx.fillStyle = isFlashing ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;

    // Hexagonal cruiser hull
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * this.radius;
      const py = Math.sin(a) * this.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Cannon port
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(0, this.radius * 0.7, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (this.hp < this.maxHp && this.hp > 0) {
      this.drawHealthBar(ctx);
    }
  }
}

export class KamikazeDrone extends Enemy {
  constructor(x, y) {
    super(x, y, {
      hp: 30,
      radius: 16,
      color: '#f97316',
      scoreValue: 80,
      xpValue: 15,
      quantumValue: 2
    });
    this.coreColor = '#ffedd5';
    this.state = 'cruising'; // 'cruising', 'diving'
    this.timer = 1.2 + Math.random() * 0.8;
  }

  update(dt, screenW, screenH, blade, projectiles) {
    this.timer -= dt;

    if (this.state === 'cruising') {
      this.vy = 100;
      if (this.timer <= 0) {
        this.state = 'diving';
        const angle = Math.atan2(blade.pixelY - this.y, blade.pixelX - this.x);
        const speed = 440;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.angle = angle;
      }
    }

    super.update(dt, screenW, screenH, blade, projectiles);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle + Math.PI / 2);

    const isFlashing = this.hitFlashTimer > 0;
    const isDiving = this.state === 'diving';
    ctx.fillStyle = isFlashing ? '#ffffff' : (isDiving ? '#ef4444' : this.color);
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = isDiving ? 20 : 10;

    // Sharp dagger wing shape
    ctx.beginPath();
    ctx.moveTo(0, -this.radius * 1.4);
    ctx.lineTo(this.radius, this.radius);
    ctx.lineTo(0, this.radius * 0.6);
    ctx.lineTo(-this.radius, this.radius);
    ctx.closePath();
    ctx.fill();

    // Thruster fire if diving
    if (isDiving) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(-this.radius * 0.4, this.radius * 0.6);
      ctx.lineTo(0, this.radius * 1.6 + Math.random() * 8);
      ctx.lineTo(this.radius * 0.4, this.radius * 0.6);
      ctx.fill();
    }

    ctx.restore();

    if (this.hp < this.maxHp && this.hp > 0) {
      this.drawHealthBar(ctx);
    }
  }
}

export class ShieldedDrone extends Enemy {
  constructor(x, y) {
    super(x, y, {
      hp: 60,
      radius: 22,
      color: '#0ea5e9',
      scoreValue: 100,
      xpValue: 22,
      quantumValue: 3
    });
    this.shieldAngle = 0;
    this.vy = 75;
  }

  update(dt, screenW, screenH, blade, projectiles) {
    this.shieldAngle += dt * 2.5;
    super.update(dt, screenW, screenH, blade, projectiles);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const isFlashing = this.hitFlashTimer > 0;
    ctx.fillStyle = isFlashing ? '#ffffff' : this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    // Drone orb
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Rotating energy shield arc
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 10, this.shieldAngle, this.shieldAngle + Math.PI * 0.85);
    ctx.stroke();

    ctx.restore();

    if (this.hp < this.maxHp && this.hp > 0) {
      this.drawHealthBar(ctx);
    }
  }
}
