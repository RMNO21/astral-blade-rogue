export class Blade {
  constructor() {
    this.x = 0.5;
    this.y = 0.65;
    this.prevX = 0.5;
    this.prevY = 0.65;
    this.pixelX = 0;
    this.pixelY = 0;
    this.prevPixelX = 0;
    this.prevPixelY = 0;

    this.trail = [];
    this.maxTrailLength = 16;
    this.hitRadius = 26;

    // Hand status
    this.isHandClosed = false;
    this.isFrozen = false;

    // Dynamic Pulse Overheat & Cooldown System
    // First pulse: less than 0.5s (0.35s)
    this.baseChargeDuration = 0.35;
    this.consecutivePulses = 0;
    this.chargeTimer = 0;

    // Cooldown trackers
    this.timeSinceLastPulse = 1.0; // Starts cooled down
    this.timeHandOpen = 1.0;
    this.cooldownRequired = 1.0; // Exactly 1 second to reset back to fast pulse!
    this.justCooledDown = false;

    this.pulseRadius = 380;

    // Colors
    this.primaryColor = '#00f0ff';
    this.coreColor = '#ffffff';
    this.chargeColor = '#ffb703';

    // Active visual shockwaves
    this.activeShockwaves = [];
  }

  getCurrentChargeDuration() {
    // Escalate charging time with each consecutive pulse:
    // 0: 0.35s (< 0.5s)
    // 1: 0.75s
    // 2: 1.30s
    // 3: 2.00s
    // 4+: 2.80s
    const increments = [0.35, 0.75, 1.30, 2.00, 2.80];
    const idx = Math.min(this.consecutivePulses, increments.length - 1);
    return increments[idx];
  }

  update(handState, dt, screenW, screenH) {
    this.isHandClosed = Boolean(handState.isPinching || handState.isFist);

    let triggeredPulse = false;
    this.justCooledDown = false;

    // Track time since last pulse fired
    this.timeSinceLastPulse += dt;

    if (this.isHandClosed) {
      // 1. FREEZE POSITION: Player does NOT move when hand is closed!
      this.isFrozen = true;
      this.timeHandOpen = 0;

      // 2. Accumulate charge based on current escalated duration
      const currentChargeDuration = this.getCurrentChargeDuration();
      this.chargeTimer += dt;

      if (this.chargeTimer >= currentChargeDuration) {
        triggeredPulse = true;
        this.consecutivePulses++; // Next pulse will be longer
        this.chargeTimer = 0;
        this.timeSinceLastPulse = 0; // Reset pulse timer

        this.activeShockwaves.push({
          x: this.pixelX,
          y: this.pixelY,
          radius: 10,
          maxRadius: this.pulseRadius,
          life: 0.45,
          maxLife: 0.45
        });
      }
    } else {
      // Hand is OPEN: Move and cool down!
      this.isFrozen = false;
      this.chargeTimer = 0;

      this.timeHandOpen += dt;

      // Exactly after 2 seconds of pause / hand open, reset back to initial fast pulse (< 0.5s)
      if (this.consecutivePulses > 0) {
        if (this.timeHandOpen >= this.cooldownRequired || this.timeSinceLastPulse >= this.cooldownRequired) {
          this.consecutivePulses = 0; // Reset back to 0.35s!
          this.justCooledDown = true;
          // Spawn little celebratory cyan ring
          this.activeShockwaves.push({
            x: this.pixelX,
            y: this.pixelY,
            radius: 5,
            maxRadius: 60,
            life: 0.3,
            maxLife: 0.3
          });
        }
      }

      this.prevPixelX = this.pixelX;
      this.prevPixelY = this.pixelY;

      this.prevX = this.x;
      this.prevY = this.y;
      this.x = handState.x;
      this.y = handState.y;

      this.pixelX = this.x * screenW;
      this.pixelY = this.y * screenH;

      // Movement trail
      this.trail.unshift({
        x: this.pixelX,
        y: this.pixelY,
        time: performance.now()
      });
      if (this.trail.length > this.maxTrailLength) {
        this.trail.pop();
      }
    }

    // Update active visual shockwaves
    for (let i = this.activeShockwaves.length - 1; i >= 0; i--) {
      const sw = this.activeShockwaves[i];
      sw.life -= dt;
      const progress = 1.0 - (sw.life / sw.maxLife);
      sw.radius = 10 + progress * (sw.maxRadius - 10);
      if (sw.life <= 0) {
        this.activeShockwaves.splice(i, 1);
      }
    }

    return triggeredPulse;
  }

  getChargeProgress() {
    const duration = this.getCurrentChargeDuration();
    return Math.min(1.0, this.chargeTimer / duration);
  }

  getCooldownProgress() {
    const elapsed = Math.max(this.timeHandOpen, this.timeSinceLastPulse);
    return Math.min(1.0, elapsed / this.cooldownRequired);
  }

  getRemainingCooldown() {
    const elapsed = Math.max(this.timeHandOpen, this.timeSinceLastPulse);
    return Math.max(0, this.cooldownRequired - elapsed);
  }

  draw(ctx) {
    ctx.save();

    // 1. Draw expanding shockwaves
    for (const sw of this.activeShockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.lineWidth = 5 * alpha;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Draw Movement Ribbon Trail
    if (!this.isFrozen && this.trail.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < this.trail.length - 1; i++) {
        const p1 = this.trail[i];
        const p2 = this.trail[i + 1];
        const ratio = 1.0 - (i / this.trail.length);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = this.consecutivePulses > 0 ? '#ffb703' : this.primaryColor;
        ctx.lineWidth = (this.hitRadius * 1.4) * ratio;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 14 * ratio;
        ctx.globalAlpha = 0.45 * ratio;
        ctx.stroke();
      }
    }

    // 3. Draw Character Core
    ctx.globalAlpha = 1.0;
    const isOverheated = this.consecutivePulses > 0;
    const coreColor = this.isFrozen
      ? (isOverheated ? '#ef4444' : '#ffb703')
      : (isOverheated ? '#fbbf24' : this.coreColor);

    ctx.fillStyle = coreColor;
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.arc(this.pixelX, this.pixelY, 10, 0, Math.PI * 2);
    ctx.fill();

    // Outer Aura Ring
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.pixelX, this.pixelY, this.hitRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Draw Charge Arc when Hand is Closed / Frozen
    if (this.isFrozen && this.chargeTimer > 0) {
      const progress = this.getChargeProgress();
      const arcRadius = this.hitRadius + 14;
      const duration = this.getCurrentChargeDuration();

      // Background charge circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.pixelX, this.pixelY, arcRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Progress Arc
      ctx.strokeStyle = isOverheated ? '#ef4444' : '#ffb703';
      ctx.lineWidth = 5;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(
        this.pixelX,
        this.pixelY,
        arcRadius,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * progress)
      );
      ctx.stroke();

      // Text above character indicating current charge duration
      ctx.font = 'bold 12px Orbitron, sans-serif';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.textAlign = 'center';
      const label = this.consecutivePulses === 0
        ? `FAST: ${duration.toFixed(2)}s`
        : `OVERHEAT x${this.consecutivePulses}: ${duration.toFixed(2)}s`;
      ctx.fillText(label, this.pixelX, this.pixelY - arcRadius - 8);
    }

    // 5. If moving and cooling down back to 0.35s, show 2-second cooldown ring
    if (!this.isFrozen && this.consecutivePulses > 0) {
      const coolProgress = this.getCooldownProgress();
      const arcRadius = this.hitRadius + 10;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.pixelX, this.pixelY, arcRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(
        this.pixelX,
        this.pixelY,
        arcRadius,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * coolProgress)
      );
      ctx.stroke();

      // Text showing remaining seconds to reset
      const remain = this.getRemainingCooldown().toFixed(1);
      ctx.font = 'bold 11px Orbitron, sans-serif';
      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'center';
      ctx.fillText(`RESET IN: ${remain}s`, this.pixelX, this.pixelY - arcRadius - 8);
    }

    ctx.restore();
  }
}
