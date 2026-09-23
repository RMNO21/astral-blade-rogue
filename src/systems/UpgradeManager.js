export class UpgradeManager {
  constructor() {
    this.allUpgrades = [
      {
        id: 'plasma_reach',
        name: 'Plasma Extension',
        rarity: 'common',
        icon: '🗡️',
        desc: 'Increases blade slash radius and width by +30%.',
        apply: (game) => {
          game.blade.hitRadius *= 1.3;
        }
      },
      {
        id: 'chain_lightning',
        name: 'Tesla Arc',
        rarity: 'rare',
        icon: '⚡',
        desc: 'Slicing enemies unleashes lightning arcs to 3 nearby foes for 35 dmg.',
        apply: (game) => {
          game.blade.hasLightning = true;
          game.blade.lightningBounces += 1;
        }
      },
      {
        id: 'orbit_drones',
        name: 'Star Drones',
        rarity: 'rare',
        icon: '🛸',
        desc: 'Deploys 2 autonomous laser drones that orbit your hand.',
        apply: (game) => {
          game.blade.hasOrbitDrones = true;
          game.blade.droneCount += 1;
        }
      },
      {
        id: 'supernova_blast',
        name: 'Supernova',
        rarity: 'epic',
        icon: '💥',
        desc: 'Pinch/Fist charge blast radius +50% and damage doubled.',
        apply: (game) => {
          game.blade.novaRadius *= 1.5;
          game.blade.novaDamage *= 2.0;
        }
      },
      {
        id: 'magnet_matrix',
        name: 'Quantum Magnet',
        rarity: 'common',
        icon: '🧲',
        desc: 'Increases XP and Stardust collection radius by +100%.',
        apply: (game) => {
          game.magnetRadius *= 2.0;
        }
      },
      {
        id: 'chrono_shift',
        name: 'Chrono Dilation',
        rarity: 'epic',
        icon: '⏳',
        desc: 'Slicing slows down all enemies by 40% for 1.5 seconds.',
        apply: (game) => {
          game.hasChronoShift = true;
        }
      },
      {
        id: 'deflect_overdrive',
        name: 'Kinetic Deflector',
        rarity: 'rare',
        icon: '🛡️',
        desc: 'Deflected projectiles deal +150% extra damage with homing velocity.',
        apply: (game) => {
          game.blade.deflectMultiplier *= 2.2;
        }
      },
      {
        id: 'vampiric_edge',
        name: 'Vampiric Aegis',
        rarity: 'epic',
        icon: '🩸',
        desc: 'Every 8 combo slices instantly restores 20 shield energy.',
        apply: (game) => {
          game.hasVampiricAegis = true;
        }
      },
      {
        id: 'hyper_crit',
        name: 'Critical Surge',
        rarity: 'rare',
        icon: '🎯',
        desc: '+20% Critical Strike chance and +50% Crit Damage.',
        apply: (game) => {
          game.blade.critChance += 0.20;
          game.blade.critMultiplier += 0.5;
        }
      },
      {
        id: 'overdrive_core',
        name: 'Reactor Core',
        rarity: 'legendary',
        icon: '⚛️',
        desc: '+40% Total Blade Damage and fast pinch recharge rate.',
        apply: (game) => {
          game.blade.damageMultiplier *= 1.4;
          game.blade.chargeRate *= 1.6;
        }
      },
      {
        id: 'frost_bite',
        name: 'Glacial Chill',
        rarity: 'common',
        icon: '❄️',
        desc: 'Hits apply frost, slowing enemies by 50% for 2.5 seconds.',
        apply: (game) => {
          game.blade.hasFrost = true;
        }
      },
      {
        id: 'phoenix_matrix',
        name: 'Phoenix Protocol',
        rarity: 'legendary',
        icon: '🔥',
        desc: 'Upon taking fatal damage, triggers a screen-wide blast and heals 50% shield.',
        apply: (game) => {
          game.hasPhoenixProtocol = true;
        }
      }
    ];

    this.activeUpgrades = [];
  }

  getRandomUpgrades(count = 3) {
    const shuffled = [...this.allUpgrades].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  applyUpgrade(upgradeId, game) {
    const up = this.allUpgrades.find(u => u.id === upgradeId);
    if (up) {
      up.apply(game);
      this.activeUpgrades.push(up);
      return up;
    }
    return null;
  }

  reset() {
    this.activeUpgrades = [];
  }
}
