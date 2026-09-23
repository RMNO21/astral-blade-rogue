export class MetaProgression {
  constructor() {
    this.storageKey = 'astral_blade_save_v1';
    this.data = this.getDefaults();
    this.load();

    this.weapons = [
      {
        id: 'cyber_katana',
        name: 'Cyber Katana',
        desc: 'Balanced plasma blade with ultra-fast responsiveness.',
        cost: 0,
        primaryColor: '#00f0ff',
        coreColor: '#ffffff',
        accentColor: '#0088ff',
        baseDamage: 50,
        critChance: 0.15,
        critMultiplier: 2.0
      },
      {
        id: 'solar_glaive',
        name: 'Solar Glaive',
        desc: 'Scorching solar flame that burns targets and grants +25% blade reach.',
        cost: 100,
        primaryColor: '#f59e0b',
        coreColor: '#fffbeb',
        accentColor: '#ef4444',
        baseDamage: 65,
        critChance: 0.18,
        critMultiplier: 2.2
      },
      {
        id: 'void_scythe',
        name: 'Void Scythe',
        desc: 'Dark matter scythe that inflicts devastating critical damage.',
        cost: 250,
        primaryColor: '#a855f7',
        coreColor: '#faf5ff',
        accentColor: '#6b21a8',
        baseDamage: 80,
        critChance: 0.25,
        critMultiplier: 2.6
      },
      {
        id: 'frost_rapier',
        name: 'Frost Rapier',
        desc: 'Crystalline blade that chills foes on contact and freezes on crits.',
        cost: 450,
        primaryColor: '#38bdf8',
        coreColor: '#ffffff',
        accentColor: '#0284c7',
        baseDamage: 70,
        critChance: 0.30,
        critMultiplier: 2.4
      }
    ];
  }

  getDefaults() {
    return {
      stardust: 0,
      equippedWeapon: 'cyber_katana',
      unlockedWeapons: ['cyber_katana'],
      upgrades: {
        shield_capacity: 0, // max 5 (+20 shield/lvl)
        blade_lethality: 0, // max 5 (+10% dmg/lvl)
        crit_mastery: 0,    // max 5 (+5% crit/lvl)
        quantum_magnet: 0,  // max 5 (+30px magnet/lvl)
        stardust_harvest: 0 // max 5 (+20% bonus shards)
      },
      stats: {
        runsPlayed: 0,
        enemiesSliced: 0,
        bossesDefeated: 0,
        highestCombo: 0,
        totalPlaytime: 0,
        highestScore: 0
      },
      achievements: []
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...this.getDefaults(), ...parsed };
      }
    } catch (e) {
      console.warn('Could not load save data from localStorage:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Could not save data to localStorage:', e);
    }
  }

  addStardust(amount) {
    const bonus = 1.0 + (this.data.upgrades.stardust_harvest * 0.2);
    const earned = Math.round(amount * bonus);
    this.data.stardust += earned;
    this.save();
    return earned;
  }

  unlockWeapon(weaponId) {
    const w = this.weapons.find(item => item.id === weaponId);
    if (!w) return false;
    if (this.data.unlockedWeapons.includes(weaponId)) return true;
    if (this.data.stardust >= w.cost) {
      this.data.stardust -= w.cost;
      this.data.unlockedWeapons.push(weaponId);
      this.save();
      return true;
    }
    return false;
  }

  equipWeapon(weaponId) {
    if (this.data.unlockedWeapons.includes(weaponId)) {
      this.data.equippedWeapon = weaponId;
      this.save();
      return true;
    }
    return false;
  }

  getEquippedWeapon() {
    return this.weapons.find(w => w.id === this.data.equippedWeapon) || this.weapons[0];
  }

  getUpgradeCost(type) {
    const currentLvl = this.data.upgrades[type] || 0;
    if (currentLvl >= 5) return null; // Max level
    const baseCosts = {
      shield_capacity: 40,
      blade_lethality: 50,
      crit_mastery: 60,
      quantum_magnet: 35,
      stardust_harvest: 50
    };
    return baseCosts[type] * Math.pow(1.6, currentLvl);
  }

  buyUpgrade(type) {
    const cost = this.getUpgradeCost(type);
    if (cost === null) return false;
    if (this.data.stardust >= cost) {
      this.data.stardust -= Math.round(cost);
      this.data.upgrades[type] = (this.data.upgrades[type] || 0) + 1;
      this.save();
      return true;
    }
    return false;
  }
}
