/**
 * OneEuroFilter: Adaptive low-pass filter to remove jitter at low speeds
 * while eliminating latency during fast movements.
 * Based on: Casiez, Roussel, Vogel (CHI 2012)
 */
class LowPassFilter {
  constructor(alpha = 0) {
    this.setAlpha(alpha);
    this.y = null;
    this.s = null;
  }

  setAlpha(alpha) {
    if (alpha <= 0 || alpha > 1.0) alpha = 0.5;
    this.alpha = alpha;
  }

  filter(value) {
    let result;
    if (this.y === null) {
      result = value;
    } else {
      result = this.alpha * value + (1.0 - this.alpha) * this.s;
    }
    this.y = value;
    this.s = result;
    return result;
  }

  hasLastRawValue() {
    return this.y !== null;
  }

  lastRawValue() {
    return this.y;
  }

  reset() {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  constructor(freq = 60, minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
    this.freq = freq;
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.x = new LowPassFilter(this.alpha(minCutoff));
    this.dx = new LowPassFilter(this.alpha(dCutoff));
    this.lastTime = null;
  }

  alpha(cutoff) {
    const te = 1.0 / this.freq;
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / te);
  }

  filter(value, timestamp = null) {
    if (this.lastTime !== null && timestamp !== null) {
      const dt = (timestamp - this.lastTime) / 1000.0;
      if (dt > 0) this.freq = 1.0 / dt;
    }
    this.lastTime = timestamp;

    const prevRaw = this.x.hasLastRawValue() ? this.x.lastRawValue() : value;
    const dvalue = (value - prevRaw) * this.freq;
    const edvalue = this.dx.filter(dvalue);
    const cutoff = this.minCutoff + this.beta * Math.abs(edvalue);
    this.x.setAlpha(this.alpha(cutoff));

    return this.x.filter(value);
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.lastTime = null;
  }
}

export class PointFilter2D {
  constructor(freq = 60, minCutoff = 1.2, beta = 0.08, dCutoff = 1.0) {
    this.filterX = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
    this.filterY = new OneEuroFilter(freq, minCutoff, beta, dCutoff);
  }

  filter(x, y, timestamp = performance.now()) {
    return {
      x: this.filterX.filter(x, timestamp),
      y: this.filterY.filter(y, timestamp)
    };
  }

  reset() {
    this.filterX.reset();
    this.filterY.reset();
  }
}
