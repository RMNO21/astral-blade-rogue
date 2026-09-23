import { PointFilter2D } from './OneEuroFilter.js';

export class HandTracker {
  constructor(options = {}) {
    this.videoElement = null;
    this.pipCanvas = null;
    this.pipCtx = null;
    this.camera = null;
    this.hands = null;

    this.isTracking = false;
    this.isCameraActive = false;
    this.isMirrored = true;
    this.useMouseFallback = false;

    // Filtered coordinates
    this.bladeFilter = new PointFilter2D(60, 1.2, 0.08, 1.0);
    this.offhandFilter = new PointFilter2D(60, 1.2, 0.08, 1.0);

    // Persistent multi-hand slots & motion-priority tracking
    this.trackedSlots = []; // Persistent slots: { id, palmX, palmY, indexX, indexY, activity, landmarks, missingFrames }
    this.primarySlotId = null;
    this.switchTimer = 0;
    this.handLostTimer = 0;

    // Current state output
    this.state = {
      tracked: false,
      x: 0.5,
      y: 0.5,
      prevX: 0.5,
      prevY: 0.5,
      vx: 0,
      vy: 0,
      speed: 0,
      isPinching: false,
      pinchProgress: 0,
      isFist: false,
      isSlashing: false,
      handCount: 0,
      rawLandmarks: null,
      offhand: {
        tracked: false,
        x: 0,
        y: 0,
        isPinching: false
      }
    };

    // Tracking hysteresis
    this.pinchHoldTime = 0;
    this.lastFrameTime = performance.now();
    this.callbacks = {
      onStateUpdate: options.onStateUpdate || null,
      onTrackingStatus: options.onTrackingStatus || null
    };

    this.mousePos = { x: 0.5, y: 0.5 };
    this.mouseDown = false;
  }

  async init(videoElement, pipCanvas) {
    this.videoElement = videoElement;
    this.pipCanvas = pipCanvas;
    if (this.pipCanvas) {
      this.pipCtx = this.pipCanvas.getContext('2d');
    }

    this.setupMouseFallback();

    const hasMediaPipe = typeof window.Hands !== 'undefined';
    if (!hasMediaPipe) {
      console.warn('MediaPipe Hands not detected in global scope. Waiting for script to load or falling back to mouse.');
      this.notifyStatus('waiting_library');
    }

    return hasMediaPipe;
  }

  setupMouseFallback() {
    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = e.clientX / window.innerWidth;
      this.mousePos.y = e.clientY / window.innerHeight;
      if (this.useMouseFallback || !this.isCameraActive) {
        this.updateFromMouse();
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
      }
    });

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.mousePos.x = t.clientX / window.innerWidth;
        this.mousePos.y = t.clientY / window.innerHeight;
        this.mouseDown = true;
        if (this.useMouseFallback || !this.isCameraActive) {
          this.updateFromMouse();
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        const t = e.touches[0];
        this.mousePos.x = t.clientX / window.innerWidth;
        this.mousePos.y = t.clientY / window.innerHeight;
        if (this.useMouseFallback || !this.isCameraActive) {
          this.updateFromMouse();
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      this.mouseDown = false;
    });
  }

  updateFromMouse() {
    const now = performance.now();
    const dt = Math.max((now - this.lastFrameTime) / 1000, 0.001);
    this.lastFrameTime = now;

    const filtered = this.bladeFilter.filter(this.mousePos.x, this.mousePos.y, now);
    const vx = (filtered.x - this.state.x) / dt;
    const vy = (filtered.y - this.state.y) / dt;
    const speed = Math.hypot(vx, vy);

    this.state.prevX = this.state.x;
    this.state.prevY = this.state.y;
    this.state.x = filtered.x;
    this.state.y = filtered.y;
    this.state.vx = vx;
    this.state.vy = vy;
    this.state.speed = speed;
    this.state.isSlashing = speed > 1.2;
    this.state.isPinching = this.mouseDown;
    this.state.pinchProgress = this.mouseDown ? Math.min(1.0, this.state.pinchProgress + dt * 2.5) : Math.max(0, this.state.pinchProgress - dt * 4);
    this.state.isFist = this.mouseDown;
    this.state.tracked = true;
    this.state.handCount = 1;

    if (this.callbacks.onStateUpdate) {
      this.callbacks.onStateUpdate(this.state);
    }
  }

  async startWebcam() {
    if (typeof window.Hands === 'undefined') {
      console.warn('Hands library not ready, defaulting to mouse mode.');
      this.useMouseFallback = true;
      this.notifyStatus('mouse_mode');
      return false;
    }

    try {
      this.notifyStatus('requesting_camera');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 60, min: 30 },
          facingMode: 'user'
        }
      });

      this.videoElement.srcObject = stream;
      await this.videoElement.play();

      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      this.hands.onResults((results) => this.onMediaPipeResults(results));

      if (window.Camera) {
        this.camera = new window.Camera(this.videoElement, {
          onFrame: async () => {
            if (this.isCameraActive && this.videoElement) {
              await this.hands.send({ image: this.videoElement });
            }
          },
          width: 640,
          height: 480
        });
        await this.camera.start();
      } else {
        const processFrame = async () => {
          if (this.isCameraActive) {
            await this.hands.send({ image: this.videoElement });
            if ('requestVideoFrameCallback' in this.videoElement) {
              this.videoElement.requestVideoFrameCallback(processFrame);
            } else {
              requestAnimationFrame(processFrame);
            }
          }
        };
        processFrame();
      }

      this.isCameraActive = true;
      this.useMouseFallback = false;
      this.notifyStatus('camera_active');
      return true;
    } catch (err) {
      console.error('Camera initialization error:', err);
      this.useMouseFallback = true;
      this.isCameraActive = false;
      this.notifyStatus('camera_error');
      return false;
    }
  }

  stopWebcam() {
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    if (this.camera && this.camera.stop) {
      this.camera.stop();
    }
    this.isCameraActive = false;
    this.useMouseFallback = true;
    this.notifyStatus('mouse_mode');
  }

  toggleMirror() {
    this.isMirrored = !this.isMirrored;
    return this.isMirrored;
  }

  onMediaPipeResults(results) {
    const now = performance.now();
    const dt = Math.max((now - this.lastFrameTime) / 1000, 0.001);
    this.lastFrameTime = now;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.state.tracked = false;
      this.state.handCount = 0;
      this.handLostTimer += dt;
      if (this.handLostTimer > 0.8) {
        this.trackedSlots = [];
        this.primarySlotId = null;
      }
      this.drawPIP();
      this.notifyStatus('hand_lost');
      return;
    }

    this.handLostTimer = 0;
    this.state.tracked = true;
    this.state.handCount = results.multiHandLandmarks.length;
    this.notifyStatus('hand_tracked');

    // 1. Convert incoming raw landmarks into detected candidates
    const candidates = results.multiHandLandmarks.map((lm, idx) => {
      // Landmark 0: wrist, 9: middle finger MCP base -> center of palm
      const palmX = this.isMirrored ? (1.0 - (lm[0].x + lm[9].x) * 0.5) : ((lm[0].x + lm[9].x) * 0.5);
      const palmY = (lm[0].y + lm[9].y) * 0.5;
      const indexX = this.isMirrored ? (1.0 - lm[8].x) : lm[8].x;
      const indexY = lm[8].y;
      return {
        rawIndex: idx,
        landmarks: lm,
        palmX,
        palmY,
        indexX,
        indexY
      };
    });

    // 2. Associate detected hands with persistent slots using bipartite proximity matching
    if (this.trackedSlots.length === 0) {
      this.trackedSlots = candidates.map((c, i) => ({
        id: 'hand_' + (i + 1),
        palmX: c.palmX,
        palmY: c.palmY,
        indexX: c.indexX,
        indexY: c.indexY,
        activity: 0,
        landmarks: c.landmarks,
        missingFrames: 0
      }));
      this.primarySlotId = this.trackedSlots[0].id;
    } else if (candidates.length === 1 && this.trackedSlots.length === 1) {
      const s = this.trackedSlots[0];
      const c = candidates[0];
      const dist = Math.hypot(c.palmX - s.palmX, c.palmY - s.palmY);
      const speed = dist / dt;
      s.activity = (s.activity * 0.70) + (speed * 0.30);
      s.palmX = c.palmX;
      s.palmY = c.palmY;
      s.indexX = c.indexX;
      s.indexY = c.indexY;
      s.landmarks = c.landmarks;
      s.missingFrames = 0;
      this.primarySlotId = s.id;
    } else if (candidates.length === 2 && this.trackedSlots.length === 2) {
      // 2 slots, 2 detected hands: Hungarian / bipartite matching
      const c0 = candidates[0], c1 = candidates[1];
      const s0 = this.trackedSlots[0], s1 = this.trackedSlots[1];
      const cost00 = Math.hypot(c0.palmX - s0.palmX, c0.palmY - s0.palmY) +
                     Math.hypot(c1.palmX - s1.palmX, c1.palmY - s1.palmY);
      const cost01 = Math.hypot(c0.palmX - s1.palmX, c0.palmY - s1.palmY) +
                     Math.hypot(c1.palmX - s0.palmX, c1.palmY - s0.palmY);

      const [p0, p1] = cost00 <= cost01 ? [c0, c1] : [c1, c0];

      const d0 = Math.hypot(p0.palmX - s0.palmX, p0.palmY - s0.palmY);
      s0.activity = (s0.activity * 0.70) + ((d0 / dt) * 0.30);
      s0.palmX = p0.palmX;
      s0.palmY = p0.palmY;
      s0.indexX = p0.indexX;
      s0.indexY = p0.indexY;
      s0.landmarks = p0.landmarks;
      s0.missingFrames = 0;

      const d1 = Math.hypot(p1.palmX - s1.palmX, p1.palmY - s1.palmY);
      s1.activity = (s1.activity * 0.70) + ((d1 / dt) * 0.30);
      s1.palmX = p1.palmX;
      s1.palmY = p1.palmY;
      s1.indexX = p1.indexX;
      s1.indexY = p1.indexY;
      s1.landmarks = p1.landmarks;
      s1.missingFrames = 0;
    } else if (candidates.length === 2 && this.trackedSlots.length === 1) {
      const s0 = this.trackedSlots[0];
      const dist0 = Math.hypot(candidates[0].palmX - s0.palmX, candidates[0].palmY - s0.palmY);
      const dist1 = Math.hypot(candidates[1].palmX - s0.palmX, candidates[1].palmY - s0.palmY);
      const [matched, newHand] = dist0 <= dist1 ? [candidates[0], candidates[1]] : [candidates[1], candidates[0]];

      const d0 = Math.hypot(matched.palmX - s0.palmX, matched.palmY - s0.palmY);
      s0.activity = (s0.activity * 0.70) + ((d0 / dt) * 0.30);
      s0.palmX = matched.palmX;
      s0.palmY = matched.palmY;
      s0.indexX = matched.indexX;
      s0.indexY = matched.indexY;
      s0.landmarks = matched.landmarks;
      s0.missingFrames = 0;

      this.trackedSlots.push({
        id: 'hand_' + (s0.id === 'hand_1' ? '2' : '1'),
        palmX: newHand.palmX,
        palmY: newHand.palmY,
        indexX: newHand.indexX,
        indexY: newHand.indexY,
        activity: 0,
        landmarks: newHand.landmarks,
        missingFrames: 0
      });
    } else if (candidates.length === 1 && this.trackedSlots.length === 2) {
      const c = candidates[0];
      const s0 = this.trackedSlots[0], s1 = this.trackedSlots[1];
      const dist0 = Math.hypot(c.palmX - s0.palmX, c.palmY - s0.palmY);
      const dist1 = Math.hypot(c.palmX - s1.palmX, c.palmY - s1.palmY);

      if (dist0 <= dist1) {
        s0.activity = (s0.activity * 0.70) + ((dist0 / dt) * 0.30);
        s0.palmX = c.palmX;
        s0.palmY = c.palmY;
        s0.indexX = c.indexX;
        s0.indexY = c.indexY;
        s0.landmarks = c.landmarks;
        s0.missingFrames = 0;
        s1.missingFrames++;
      } else {
        s1.activity = (s1.activity * 0.70) + ((dist1 / dt) * 0.30);
        s1.palmX = c.palmX;
        s1.palmY = c.palmY;
        s1.indexX = c.indexX;
        s1.indexY = c.indexY;
        s1.landmarks = c.landmarks;
        s1.missingFrames = 0;
        s0.missingFrames++;
      }

      if (s0.missingFrames > 12 || s1.missingFrames > 12) {
        this.trackedSlots = this.trackedSlots.filter(s => s.missingFrames <= 12);
        if (!this.trackedSlots.some(s => s.id === this.primarySlotId)) {
          this.primarySlotId = this.trackedSlots[0].id;
          this.bladeFilter.reset();
        }
      }
    }

    // 3. Determine Active Primary Hand based on motion dominance and stability
    const activeSlots = this.trackedSlots.filter(s => s.missingFrames === 0);
    if (activeSlots.length === 1) {
      if (this.primarySlotId !== activeSlots[0].id) {
        this.primarySlotId = activeSlots[0].id;
        this.bladeFilter.reset();
      }
      this.switchTimer = 0;
    } else if (activeSlots.length >= 2) {
      let currentPrimary = activeSlots.find(s => s.id === this.primarySlotId) || activeSlots[0];
      let otherSlot = activeSlots.find(s => s.id !== currentPrimary.id);

      // The other hand becomes primary IF AND ONLY IF:
      // 1) The other hand is clearly moving (activity > 0.14)
      // AND
      // 2) The current primary is stationary/quiet (activity < 0.08) OR the other hand moves at least 2x faster (otherSlot.activity > currentPrimary.activity * 2.0 + 0.05)
      const otherMoving = otherSlot.activity > 0.14;
      const currentStatic = currentPrimary.activity < 0.08;
      const otherDominating = otherSlot.activity > (currentPrimary.activity * 2.0 + 0.05);

      if (otherMoving && (currentStatic || otherDominating)) {
        this.switchTimer += dt;
        // Require intentional movement for 100ms before switching, preventing single-frame glitches
        if (this.switchTimer > 0.10) {
          this.primarySlotId = otherSlot.id;
          this.bladeFilter.reset();
          this.switchTimer = 0;
        }
      } else {
        this.switchTimer = Math.max(0, this.switchTimer - dt * 2);
      }
    }

    // 4. Extract state from primary slot
    const primarySlot = this.trackedSlots.find(s => s.id === this.primarySlotId) || this.trackedSlots[0];
    const offhandSlot = this.trackedSlots.find(s => s.id !== primarySlot.id);

    const landmarks = primarySlot.landmarks;
    this.state.rawLandmarks = landmarks;

    // Apply One-Euro filter to completely eliminate micro-jitter for the primary hand
    const filtered = this.bladeFilter.filter(primarySlot.indexX, primarySlot.indexY, now);

    const vx = (filtered.x - this.state.x) / dt;
    const vy = (filtered.y - this.state.y) / dt;
    const speed = Math.hypot(vx, vy);

    this.state.prevX = this.state.x;
    this.state.prevY = this.state.y;
    this.state.x = filtered.x;
    this.state.y = filtered.y;
    this.state.vx = vx;
    this.state.vy = vy;
    this.state.speed = speed;
    this.state.isSlashing = speed > 1.2;

    // Pinch & Fist detection for the primary hand ONLY
    const palmScale = Math.hypot(
      landmarks[9].x - landmarks[0].x,
      landmarks[9].y - landmarks[0].y
    ) || 0.2;

    const pinchDist = Math.hypot(
      landmarks[8].x - landmarks[4].x,
      landmarks[8].y - landmarks[4].y
    ) / palmScale;

    const fingerTips = [8, 12, 16, 20];
    let avgTipDist = 0;
    for (let idx of fingerTips) {
      avgTipDist += Math.hypot(landmarks[idx].x - landmarks[9].x, landmarks[idx].y - landmarks[9].y);
    }
    avgTipDist = (avgTipDist / fingerTips.length) / palmScale;
    this.state.isFist = avgTipDist < 0.65;

    if (pinchDist < 0.45 || this.state.isFist) {
      this.state.isPinching = true;
      this.state.pinchProgress = Math.min(1.0, this.state.pinchProgress + dt * 2.5);
    } else if (pinchDist > 0.6) {
      this.state.isPinching = false;
      this.state.pinchProgress = Math.max(0, this.state.pinchProgress - dt * 4.0);
    }

    if (offhandSlot && offhandSlot.missingFrames === 0) {
      this.state.offhand = {
        tracked: true,
        x: offhandSlot.indexX,
        y: offhandSlot.indexY,
        activity: offhandSlot.activity
      };
    } else {
      this.state.offhand.tracked = false;
    }

    // Render PIP overlay with primary vs secondary hand distinction
    this.drawPIP();

    if (this.callbacks.onStateUpdate) {
      this.callbacks.onStateUpdate(this.state);
    }
  }

  drawPIP() {
    if (!this.pipCtx || !this.pipCanvas) return;
    const ctx = this.pipCtx;
    const w = this.pipCanvas.width;
    const h = this.pipCanvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(8, 12, 24, 0.75)';
    ctx.fillRect(0, 0, w, h);

    if (this.videoElement && this.videoElement.readyState >= 2) {
      ctx.save();
      if (this.isMirrored) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.videoElement, 0, 0, w, h);
      ctx.restore();
    }

    const activeSlots = this.trackedSlots.filter(s => s.missingFrames === 0);
    if (activeSlots.length === 0) {
      ctx.fillStyle = '#ff477e';
      ctx.font = '11px Rajdhani, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('در انتظار دست...', w / 2, h / 2);
      return;
    }

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [0, 17] // Palm base
    ];

    activeSlots.forEach(slot => {
      const isPrimary = slot.id === this.primarySlotId;
      const landmarks = slot.landmarks;
      if (!landmarks) return;

      // Primary hand gets bright cyan/gold, secondary hand gets faint dim purple
      const boneColor = isPrimary
        ? (this.state.isPinching ? '#ffb703' : '#00f0ff')
        : 'rgba(168, 85, 247, 0.35)';
      const jointColor = isPrimary ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';

      ctx.strokeStyle = boneColor;
      ctx.lineWidth = isPrimary ? 2 : 1;
      ctx.beginPath();
      for (const [i, j] of connections) {
        const x1 = (this.isMirrored ? 1.0 - landmarks[i].x : landmarks[i].x) * w;
        const y1 = landmarks[i].y * h;
        const x2 = (this.isMirrored ? 1.0 - landmarks[j].x : landmarks[j].x) * w;
        const y2 = landmarks[j].y * h;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();

      for (let i = 0; i < landmarks.length; i++) {
        const x = (this.isMirrored ? 1.0 - landmarks[i].x : landmarks[i].x) * w;
        const y = landmarks[i].y * h;
        const isTip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);

        ctx.fillStyle = isTip ? (i === 8 && isPrimary ? '#00f0ff' : jointColor) : jointColor;
        ctx.beginPath();
        ctx.arc(x, y, isTip ? (isPrimary ? 4 : 2) : (isPrimary ? 2 : 1), 0, Math.PI * 2);
        ctx.fill();

        if (i === 8 && isPrimary) {
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Small floating tag above wrist
      const wristX = (this.isMirrored ? 1.0 - landmarks[0].x : landmarks[0].x) * w;
      const wristY = landmarks[0].y * h - 10;
      ctx.fillStyle = isPrimary ? (this.state.isPinching ? '#ffb703' : '#00f0ff') : 'rgba(168, 85, 247, 0.7)';
      ctx.font = 'bold 9px Vazirmatn, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isPrimary ? 'دست اصلی' : 'فرعی (ساکن)', wristX, Math.max(12, wristY));
    });

    // Tag showing active moving primary hand vs static hand
    ctx.fillStyle = this.state.isPinching ? '#ffb703' : '#00f0ff';
    ctx.font = 'bold 10px Vazirmatn, sans-serif';
    ctx.textAlign = 'left';
    let handTag = '● ۱ دست شناسایی شد';
    if (activeSlots.length > 1) {
      handTag = '● دست متحرک: اصلی | دست ساکن: فیلتر شد';
    }
    ctx.fillText(handTag, 6, h - 6);
  }

  notifyStatus(status) {
    if (this.callbacks.onTrackingStatus) {
      this.callbacks.onTrackingStatus(status);
    }
  }
}
