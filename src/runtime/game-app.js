import { CONFIG } from '../data/config.js';
import { GameLoop } from '../core/game-loop.js';
import { applyUpgrade, createRun, createUpgradeChoices, damagePlayer, restartRun } from '../core/model.js';
import { stepSimulation } from '../core/simulation.js';
import { AudioSystem } from './audio.js';
import { createFrameSampler, recordFrame } from './frame-telemetry.js';
import { InputSystem } from './input.js';
import { Renderer } from './renderer.js';

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export class GameApp {
  constructor(documentRoot = document) {
    this.document = documentRoot;
    this.elements = {
      canvas: documentRoot.querySelector('#game-canvas'),
      hud: documentRoot.querySelector('#hud'),
      title: documentRoot.querySelector('#title-panel'),
      upgrade: documentRoot.querySelector('#upgrade-panel'),
      reactionRouteRule: documentRoot.querySelector('#reaction-route-rule'),
      upgradeChoices: documentRoot.querySelector('#upgrade-choices'),
      pause: documentRoot.querySelector('#pause-panel'),
      gameOver: documentRoot.querySelector('#game-over-panel'),
      summary: documentRoot.querySelector('#run-summary'),
      health: documentRoot.querySelector('#health-pips'),
      time: documentRoot.querySelector('#run-time'),
      level: documentRoot.querySelector('#run-level'),
      xpBar: documentRoot.querySelector('#xp-bar'),
      xp: documentRoot.querySelector('#xp-fill'),
      xpHint: documentRoot.querySelector('#xp-hint'),
      weapons: documentRoot.querySelector('#weapon-strip'),
      touchStick: documentRoot.querySelector('#touch-stick'),
      status: documentRoot.querySelector('#status-region'),
    };
    this.run = createRun();
    this.frameSampler = createFrameSampler();
    this.renderer = new Renderer(this.elements.canvas, CONFIG);
    this.audio = new AudioSystem();
    this.input = new InputSystem(window, () => this.togglePause(), this.elements.touchStick);
    this.loop = new GameLoop({
      step: (dt) => this.step(dt),
      render: () => this.render(),
    });
    this.lastWeaponSignature = '';
    this.boundVisibility = () => {
      if (document.hidden && this.run.state === 'running') this.pause();
    };
  }

  init() {
    this.input.attach();
    this.renderer.resize();
    window.addEventListener('resize', this.renderer.resize);
    document.addEventListener('visibilitychange', this.boundVisibility);
    this.document.querySelector('#start-button').addEventListener('click', () => this.start());
    this.document.querySelector('#restart-button').addEventListener('click', () => this.restart());
    this.document.querySelector('#pause-button').addEventListener('click', () => this.pause());
    this.document.querySelector('#resume-button').addEventListener('click', () => this.resume());
    this.syncUi();
    this.loop.start();
    document.documentElement.dataset.gameReady = 'ready';
    this.installTestSnapshot();
  }

  start() {
    this.audio.unlock();
    this.run = createRun({ state: 'running', seed: Date.now(), runId: this.run.id });
    this.frameSampler = createFrameSampler();
    this.lastWeaponSignature = '';
    this.renderer.resetTransientEffects();
    this.input.clear();
    this.loop.resume();
    this.announce('战斗开始。使用方向键、WASD 或屏幕摇杆移动，攻击会自动释放。');
    this.syncUi();
  }

  restart() {
    this.audio.unlock();
    this.run = restartRun(this.run);
    this.frameSampler = createFrameSampler();
    this.lastWeaponSignature = '';
    this.renderer.resetTransientEffects();
    this.input.clear();
    this.loop.resume();
    this.announce('新的元素觉醒开始。');
    this.syncUi();
  }

  step(dt) {
    stepSimulation(this.run, { dt, input: this.input.direction, config: CONFIG });
    this.renderer.react(this.run.events);
    this.audio.handle(this.run.events);
    if (this.run.state === 'levelUp') this.openUpgradeSelection();
    else if (this.run.state === 'gameOver') this.openGameOver();
  }

  render() {
    recordFrame(this.run.stats, this.frameSampler, performance.now(), this.run.state === 'running');
    this.renderer.render(this.run);
    this.syncHud();
  }

  openUpgradeSelection() {
    this.input.clear();
    this.loop.pause();
    const isFirstUpgrade = this.run.stats.upgradePicks.length === 0;
    let choices = createUpgradeChoices(this.run, CONFIG);
    if (choices.length === 0) {
      this.run.pendingLevelUps = 0;
      this.run.state = 'running';
      this.loop.resume();
      return;
    }
    this.elements.upgradeChoices.replaceChildren(...choices.map((upgrade) => {
      const button = this.document.createElement('button');
      const isReaction = upgrade.kind === 'reaction';
      button.type = 'button';
      button.className = `upgrade-card upgrade-card--${isReaction ? 'reaction' : 'standard'}`;
      button.dataset.upgradeId = upgrade.id;
      const routePreview = isFirstUpgrade
        ? upgrade.id === 'windBladeUnlock'
          ? '路线预告：火 + 风 → 火焰龙卷'
          : upgrade.id === 'iceShardUnlock'
            ? '路线预告：火 + 冰 → 霜爆'
            : '即时强化 · 不锁定反应路线'
        : '';
      button.innerHTML = `<span class="upgrade-card__rarity">${isReaction ? 'ELEMENT REACTION' : 'BUILD UPGRADE'}</span><strong>${upgrade.name}</strong><span class="upgrade-card__description">${upgrade.description}</span>${routePreview ? `<span class="upgrade-card__route">${routePreview}</span>` : ''}`;
      button.addEventListener('click', () => this.chooseUpgrade(upgrade.id));
      return button;
    }));
    this.elements.reactionRouteRule.hidden = !isFirstUpgrade;
    this.syncUi();
    this.elements.upgradeChoices.firstElementChild?.focus();
    this.announce(`升级。请选择 ${choices.length} 项元素能力中的一项。`);
  }

  chooseUpgrade(upgradeId) {
    this.audio.unlock();
    this.input.clear();
    const upgrade = CONFIG.upgrades.find(({ id }) => id === upgradeId);
    if (!applyUpgrade(this.run, upgradeId, CONFIG)) return;
    this.announce(`已选择：${upgrade.name}。${upgrade.description}`);
    this.lastWeaponSignature = '';
    if (this.run.state === 'levelUp') this.openUpgradeSelection();
    else {
      this.loop.resume();
      this.syncUi();
    }
  }

  togglePause() {
    if (this.run.state === 'running') this.pause();
    else if (this.run.state === 'paused') this.resume();
  }

  pause() {
    if (this.run.state !== 'running') return;
    this.run.state = 'paused';
    this.input.clear();
    this.loop.pause();
    this.announce('游戏已暂停。');
    this.syncUi();
  }

  resume() {
    if (this.run.state !== 'paused') return;
    this.run.state = 'running';
    this.input.clear();
    this.loop.resume();
    this.announce('游戏继续。');
    this.syncUi();
  }

  openGameOver() {
    this.loop.pause();
    this.input.clear();
    const damageSource = this.run.stats.lastDamageSource?.label ?? '未知威胁';
    const damageKind = this.run.stats.lastDamageSource?.kind === 'contact' ? '接触' : '未知方式';
    const reactionId = this.run.reactionSlot;
    const routeName = reactionId ? CONFIG.reactions[reactionId].name : '未形成';
    const reactionActivations = reactionId ? (this.run.stats.reactionActivations[reactionId] ?? 0) : 0;
    const reactionHits = reactionId ? (this.run.stats.reactionHits[reactionId] ?? 0) : 0;
    this.elements.summary.innerHTML = `<span>坚持 <strong>${formatTime(this.run.time)}</strong></span><span>击杀 <strong>${this.run.stats.kills}</strong></span><span>等级 <strong>${this.run.player.level}</strong></span><span>升级 <strong>${this.run.stats.upgradePicks.length}</strong></span><span>本局路线 <strong>${routeName}</strong></span><span>反应数据 <strong>${reactionActivations} 次 · ${reactionHits} 命中</strong></span><span>最后伤害 <strong>${damageSource} · ${damageKind}</strong></span>`;
    this.syncUi();
    this.announce(`本局结束，坚持 ${formatTime(this.run.time)}，击杀 ${this.run.stats.kills}。`);
  }

  syncUi() {
    const state = this.run.state;
    this.elements.title.hidden = state !== 'title';
    this.elements.hud.hidden = state === 'title';
    this.elements.upgrade.hidden = state !== 'levelUp';
    this.elements.pause.hidden = state !== 'paused';
    this.elements.gameOver.hidden = state !== 'gameOver';
    document.documentElement.dataset.gameState = state;
    this.syncHud();
  }

  syncHud() {
    const { player } = this.run;
    this.elements.time.textContent = formatTime(this.run.time);
    this.elements.level.textContent = `等级 ${player.level}`;
    const xpRatio = Math.min(1, player.xp / player.xpToNext);
    this.elements.xp.style.width = `${xpRatio * 100}%`;
    this.elements.xpBar.setAttribute('aria-valuenow', Math.round(xpRatio * 100));
    this.elements.xpBar.classList.toggle('xp-bar--near', xpRatio >= 0.7);
    this.elements.xpBar.classList.toggle('xp-bar--imminent', xpRatio >= 0.9);
    const showXpTutorial = this.run.stats.xpCollected === 0 && this.run.xpOrbs.length > 0;
    this.elements.xpHint.textContent = showXpTutorial
      ? '靠近 ◇ 收集元素能量'
      : xpRatio >= 0.9 ? '觉醒将至' : xpRatio >= 0.7 ? '元素开始共鸣' : '';
    this.elements.health.replaceChildren(...Array.from({ length: player.maxHealth }, (_, index) => {
      const pip = this.document.createElement('span');
      pip.className = `health__pip${index >= player.health ? ' health__pip--empty' : ''}`;
      return pip;
    }));

    const reactionIds = Object.keys(this.run.unlockedReactions);
    const reactionHints = [];
    if (!this.run.reactionSlot && this.run.weapons.fireball && this.run.weapons.windBlade) {
      reactionHints.push('火 + 风 → 火焰龙卷｜持续环绕');
    }
    if (!this.run.reactionSlot && this.run.weapons.fireball && this.run.weapons.iceShard) {
      reactionHints.push('火 + 冰 → 霜爆｜减速后引爆');
    }
    const signature = `${Object.keys(this.run.weapons).join(',')}|${reactionIds.join(',')}|${reactionHints.join('|')}`;
    if (signature !== this.lastWeaponSignature) {
      const chips = Object.values(this.run.weapons).map((weapon) => {
        const chip = this.document.createElement('span');
        chip.className = `weapon-chip weapon-chip--${weapon.element}`;
        chip.textContent = weapon.name;
        return chip;
      });
      for (const id of reactionIds) {
        const chip = this.document.createElement('span');
        chip.className = 'weapon-chip weapon-chip--reaction';
        chip.textContent = CONFIG.reactions[id].name;
        chips.push(chip);
      }
      for (const hint of reactionHints) {
        const chip = this.document.createElement('span');
        chip.className = 'weapon-chip weapon-chip--hint';
        chip.textContent = hint;
        chips.push(chip);
      }
      this.elements.weapons.replaceChildren(...chips);
      this.lastWeaponSignature = signature;
    }
  }

  announce(message) {
    this.elements.status.textContent = message;
  }

  installTestSnapshot() {
    if (new URLSearchParams(location.search).get('test') !== '1') return;
    Object.defineProperty(window, '__ELEMENTAL_SURVIVOR__', {
      configurable: false,
      value: Object.freeze({
        defeat: () => {
          const applied = damagePlayer(
            this.run,
            this.run.player.health,
            Math.max(this.run.time, this.run.player.invulnerableUntil),
            CONFIG,
            { kind: 'contact', label: '测试威胁' },
          );
          if (applied) this.openGameOver();
          return applied;
        },
        snapshot: () => ({
          runId: this.run.id,
          state: this.run.state,
          time: this.run.time,
          player: { ...this.run.player },
          world: { ...CONFIG.world },
          enemyCount: this.run.enemies.length,
          enemies: this.run.enemies.map(({ id, type, x, y, radius }) => ({ id, type, x, y, radius })),
          projectileCount: this.run.projectiles.length,
          xpOrbCount: this.run.xpOrbs.length,
          xpOrbs: this.run.xpOrbs.map(({ id, x, y, value }) => ({ id, x, y, value })),
          particleCount: this.run.particles.length,
          weapons: Object.keys(this.run.weapons),
          reactions: Object.keys(this.run.unlockedReactions),
          upgrades: [...this.run.stats.upgradePicks],
          stats: JSON.parse(JSON.stringify(this.run.stats)),
          loop: { running: this.loop.running, paused: this.loop.paused },
        }),
      }),
    });
  }
}
