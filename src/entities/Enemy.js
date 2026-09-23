import { Projectile } from './Projectile.js';

export class ArrowEnemy {
  constructor(x, y, speedMult = 1.0) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.active = true;

    // Base speed scaled by game difficulty
    this.speed = (110 + Math.random() * 40) * speedMult;
    this.hp = 30;
    this.maxHp = 30;

    this.angle = Math.PI / 2; // Pointing downwards initially
    this.shootCooldown = 2.0 + Math.random() * 1.5;
    this.shootTimer = this.shootCooldown;

    this.color = '#ff0055';
    this.coreColor = '#ffffff';
    this.hitFlashTimer = 0;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlashTimer = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.active = false;
      return true;
    }
    return false;
  }

  update(dt, playerX, playerY, projectiles, screenW, screenH, difficultyMult = 1.0) {
    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }

    // Turn smoothly towards the player's position
    const targetAngle = Math.atan2(playerY - this.y, playerX - this.x);
    let diff = targetAngle - this.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), dt * 3.5);

    // Move forward in the direction of the arrow (smooth scaling)
    const currentSpeed = this.speed * Math.min(1.7, Math.sqrt(difficultyMult));
    this.vx = Math.cos(this.angle) * currentSpeed;
    this.vy = Math.sin(this.angle) * currentSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Shooting logic
    this.shootTimer -= dt;
    if (this.shootTimer <= 0) {
      this.shoot(projectiles, playerX, playerY, difficultyMult);
      // Reset cooldown (shots become faster with difficulty)
      const baseInterval = Math.max(1.2, 3.0 / Math.sqrt(difficultyMult));
      this.shootTimer = baseInterval + Math.random() * 0.8;
    }

    // Boundary check
    if (this.x < -100 || this.x > screenW + 100 || this.y < -100 || this.y > screenH + 100) {
      this.active = false;
    }
  }

  shoot(projectiles, targetX, targetY, difficultyMult) {
    const angle = Math.atan2(targetY - this.y, targetX - this.x);
    const bulletSpeed = (240 + Math.random() * 40) * Math.min(1.8, Math.sqrt(difficultyMult));

    projectiles.push(new Projectile(
      this.x + Math.cos(this.angle) * (this.radius + 6),
      this.y + Math.sin(this.angle) * (this.radius + 6),
      Math.cos(angle) * bulletSpeed,
      Math.sin(angle) * bulletSpeed,
      {
        radius: 6,
        color: '#ff2a6d',
        damage: 25
      }
    ));
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const isFlashing = this.hitFlashTimer > 0;
    ctx.fillStyle = isFlashing ? '#ffffff' : this.color;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = isFlashing ? 18 : 12;

    // Arrow / Dart geometry pointing to (1, 0)
    ctx.beginPath();
    ctx.moveTo(this.radius * 1.5, 0); // Sharp arrow tip
    ctx.lineTo(-this.radius, -this.radius * 0.9); // Left wing
    ctx.lineTo(-this.radius * 0.4, 0); // Inner notch
    ctx.lineTo(-this.radius, this.radius * 0.9); // Right wing
    ctx.closePath();
    ctx.fill();

    // Inner glowing core line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.radius * 0.9, 0);
    ctx.lineTo(-this.radius * 0.2, 0);
    ctx.stroke();

    ctx.restore();
  }
}

// Alias for compatibility
export { ArrowEnemy as Enemy };
