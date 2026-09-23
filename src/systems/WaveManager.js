import { Asteroid, Swarmer, LaserCruiser, KamikazeDrone, ShieldedDrone } from '../entities/Enemies.js';
import { Boss } from '../entities/Boss.js';

export class WaveManager {
  constructor() {
    this.mode = 'campaign'; // 'campaign' or 'endless'
    this.sector = 1;
    this.wave = 1;
    this.maxWavesPerSector = 6;

    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.isWaveActive = false;
    this.isBossWave = false;
    this.bossDefeated = false;

    this.enemiesRemainingToSpawn = 0;
  }

  startSector(sectorNum = 1, mode = 'campaign') {
    this.mode = mode;
    this.sector = sectorNum;
    this.wave = 1;
    this.bossDefeated = false;
    this.startWave(this.wave);
  }

  startWave(waveNum) {
    this.wave = waveNum;
    this.waveTimer = 0;
    this.spawnTimer = 0.4;
    this.isWaveActive = true;
    this.bossDefeated = false;

    if (this.mode === 'campaign' && this.wave === this.maxWavesPerSector) {
      this.isBossWave = true;
      this.enemiesRemainingToSpawn = 1; // Boss itself
    } else {
      this.isBossWave = false;
      // Increased enemy density for higher challenge
      const baseEnemies = 10 + this.wave * 5 + (this.sector - 1) * 8;
      this.enemiesRemainingToSpawn = baseEnemies;
    }
  }

  update(dt, game, screenW, screenH) {
    if (!this.isWaveActive) return;

    this.waveTimer += dt;
    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0 && this.enemiesRemainingToSpawn > 0) {
      this.spawnEnemy(game, screenW, screenH);
      this.enemiesRemainingToSpawn--;

      // Tighter spawn intervals (faster pacing)
      const interval = Math.max(0.45, 1.4 - (this.wave * 0.12));
      this.spawnTimer = interval;
    }

    // Check if wave is cleared
    if (this.enemiesRemainingToSpawn === 0 && game.enemies.length === 0) {
      this.onWaveCompleted(game);
    }
  }

  spawnEnemy(game, screenW, screenH) {
    if (this.isBossWave) {
      const bossType = this.sector >= 3 ? 'chrono' : 'colossus';
      const boss = new Boss(screenW / 2, -60, bossType);
      game.enemies.push(boss);
      game.audio.playBossAlarm();
      game.audio.setIntensity(2.0);
      game.renderer.addScreenShake(14);
      return;
    }

    const spawnX = 40 + Math.random() * (screenW - 80);
    const spawnY = -30;

    // Pick enemy type according to wave & sector
    const roll = Math.random();
    let enemy = null;

    if (this.sector === 1) {
      if (roll < 0.35) enemy = new Asteroid(spawnX, spawnY, Math.random() > 0.4 ? 'large' : 'small');
      else if (roll < 0.70) enemy = new Swarmer(spawnX, spawnY);
      else if (roll < 0.88) enemy = new KamikazeDrone(spawnX, spawnY);
      else enemy = new LaserCruiser(spawnX, spawnY);
    } else if (this.sector === 2) {
      if (roll < 0.30) enemy = new Swarmer(spawnX, spawnY);
      else if (roll < 0.55) enemy = new LaserCruiser(spawnX, spawnY);
      else if (roll < 0.80) enemy = new KamikazeDrone(spawnX, spawnY);
      else enemy = new ShieldedDrone(spawnX, spawnY);
    } else {
      // Sector 3+ or Endless
      if (roll < 0.30) enemy = new LaserCruiser(spawnX, spawnY);
      else if (roll < 0.55) enemy = new ShieldedDrone(spawnX, spawnY);
      else if (roll < 0.80) enemy = new KamikazeDrone(spawnX, spawnY);
      else enemy = new Swarmer(spawnX, spawnY);
    }

    if (enemy) {
      game.enemies.push(enemy);
    }
  }

  onWaveCompleted(game) {
    this.isWaveActive = false;
    game.audio.setIntensity(1.0);

    if (this.isBossWave) {
      this.bossDefeated = true;
      if (this.mode === 'campaign' && this.sector < 3) {
        this.sector++;
        this.startSector(this.sector, this.mode);
        game.renderer.showNotification(`SECTOR ${this.sector} REACHED!`, '#00f0ff');
      } else {
        game.onVictory();
      }
    } else {
      const nextWave = this.wave + 1;
      game.renderer.showNotification(`WAVE ${nextWave} INCOMING`, '#ffb703');
      setTimeout(() => {
        if (game.state === 'PLAYING') {
          this.startWave(nextWave);
        }
      }, 1200);
    }
  }
}
