import { CONFIG } from '../data/config.js';
import { GameLoop } from '../core/game-loop.js';
import { activateBurst, applyUpgrade, createRun, createUpgradeChoices, damagePlayer, restartRun } from '../core/model.js';
import { stepSimulation } from '../core/simulation.js';
import { AudioSystem } from './audio.js';
import { createFrameSampler, recordFrame } from './frame-telemetry.js';
import { diffHudSnapshot } from './hud-state.js';
import { InputSystem } from './input.js';
import { loadLeaderboard, recordLeaderboardEntry } from './leaderboard.js';
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
      burstButton: documentRoot.querySelector('#burst-button'),
      burstFill: documentRoot.querySelector('#burst-fill'),
      burstValue: documentRoot.querySelector('#burst-value'),
      eventBanner: documentRoot.querySelector('#event-banner'),
      titleLeaderboard: documentRoot.querySelector('#title-leaderboard'),
      gameOverLeaderboard: documentRoot.querySelector('#game-over-leaderboard'),
      status: documentRoot.querySelector('#status-region'),
    };
    this.run = createRun();
    this.frameSampler = createFrameSampler();
    this.renderer = new Renderer(this.elements.canvas, CONFIG);
    this.audio = new AudioSystem();
    this.input = new InputSystem(
      window,
      () => this.togglePause(),
      this.elements.touchStick,
      () => this.triggerBurst(),
      this.elements.burstButton,
    );
    this.loop = new GameLoop({
      step: (dt) => this.step(dt),
      render: () => this.render(),
    });
    this.hudSnapshot = null;
    this.bannerUntil = 0;
    this.lastRecordedRunId = null;
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
    this.renderLeaderboard(this.elements.titleLeaderboard, loadLeaderboard());
    this.loop.start();
    document.documentElement.dataset.gameReady = 'ready';
    this.installTestSnapshot();
  }

  start() {
    this.audio.unlock();
    this.run = createRun({ state: 'running', seed: Date.now(), runId: this.run.id });
    this.frameSampler = createFrameSampler();
    this.hudSnapshot = null;
    this.bannerUntil = 0;
    this.lastRecordedRunId = null;
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
    this.hudSnapshot = null;
    this.bannerUntil = 0;
    this.lastRecordedRunId = null;
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
    this.showBattleEvents(this.run.events);
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
    const choices = createUpgradeChoices(this.run, CONFIG);
    if (choices.length === 0) {
      this.run.pendingLevelUps = 0;
      this.run.state = 'running';
      this.loop.resume();
      return;
    }
    this.elements.upgradeChoices.replaceChildren(...choices.map((upgrade) => {
      const button = this.document.createElement('button');
      const isReaction = upgrade.kind === 'reaction';
      const isMutation = upgrade.kind === 'mutation';
      const isMastery = upgrade.rarity === 'mastery';
      button.type = 'button';
      button.className = `upgrade-card upgrade-card--${isReaction ? 'reaction' : isMutation ? 'mutation' : isMastery ? 'mastery' : 'standard'}`;
      button.dataset.upgradeId = upgrade.id;
      const category = isReaction
        ? 'ELEMENT FUSION'
        : isMutation ? 'WEAPON MUTATION' : isMastery ? 'ENDLESS MASTERY' : 'BUILD UPGRADE';
      button.innerHTML = `<span class="upgrade-card__rarity">${category}</span><strong>${upgrade.name}</strong><span class="upgrade-card__description">${upgrade.description}</span>`;
      button.addEventListener('click', () => this.chooseUpgrade(upgrade.id));
      return button;
    }));
    this.elements.reactionRouteRule.hidden = false;
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

  triggerBurst() {
    this.audio.unlock();
    if (!activateBurst(this.run, CONFIG)) return false;
    this.renderer.react(this.run.events);
    this.audio.handle(this.run.events);
    this.showBattleEvents(this.run.events);
    this.announce(`元素爆发已启动，持续 ${CONFIG.burst.duration} 秒。`);
    this.syncHud();
    return true;
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
    const reactionIds = this.run.fusionSlots;
    const routeName = reactionIds.length > 0
      ? reactionIds.map((id) => CONFIG.reactions[id].name).join(' · ')
      : '未形成';
    const reactionActivations = reactionIds.reduce(
      (total, id) => total + (this.run.stats.reactionActivations[id] ?? 0),
      0,
    );
    const reactionHits = reactionIds.reduce(
      (total, id) => total + (this.run.stats.reactionHits[id] ?? 0),
      0,
    );
    this.elements.summary.innerHTML = `<span>坚持 <strong>${formatTime(this.run.time)}</strong></span><span>击杀 <strong>${this.run.stats.kills}</strong></span><span>等级 <strong>${this.run.player.level}</strong></span><span>升级 <strong>${this.run.stats.upgradePicks.length}</strong></span><span>本局路线 <strong>${routeName}</strong></span><span>反应数据 <strong>${reactionActivations} 次 · ${reactionHits} 命中</strong></span><span>最后伤害 <strong>${damageSource} · ${damageKind}</strong></span>`;
    let leaderboard = loadLeaderboard();
    if (this.lastRecordedRunId !== this.run.id) {
      leaderboard = recordLeaderboardEntry(globalThis.localStorage, {
        time: this.run.time,
        kills: this.run.stats.kills,
        level: this.run.player.level,
      });
      this.lastRecordedRunId = this.run.id;
    }
    this.renderLeaderboard(this.elements.gameOverLeaderboard, leaderboard);
    this.renderLeaderboard(this.elements.titleLeaderboard, leaderboard);
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
    const { snapshot, changed } = diffHudSnapshot(this.hudSnapshot, this.run);
    this.hudSnapshot = snapshot;

    if (changed.time) {
      this.elements.time.textContent = formatTime(this.run.time);
      this.run.stats.hudWrites += 1;
    }
    if (changed.level) {
      this.elements.level.textContent = `等级 ${player.level}`;
      this.run.stats.hudWrites += 1;
    }
    if (changed.xp) {
      const xpRatio = Math.min(1, player.xp / player.xpToNext);
      this.elements.xp.style.width = `${xpRatio * 100}%`;
      this.elements.xpBar.setAttribute('aria-valuenow', Math.round(xpRatio * 100));
      this.elements.xpBar.classList.toggle('xp-bar--near', xpRatio >= 0.7);
      this.elements.xpBar.classList.toggle('xp-bar--imminent', xpRatio >= 0.9);
      const showXpTutorial = this.run.stats.xpCollected === 0 && this.run.xpOrbs.length > 0;
      this.elements.xpHint.textContent = showXpTutorial
        ? '靠近 ◇ 收集元素能量'
        : xpRatio >= 0.9 ? '觉醒将至' : xpRatio >= 0.7 ? '元素开始共鸣' : '';
      this.run.stats.hudWrites += 5;
    }
    if (changed.health) {
      this.elements.health.replaceChildren(...Array.from({ length: player.maxHealth }, (_, index) => {
        const pip = this.document.createElement('span');
        pip.className = `health__pip${index >= player.health ? ' health__pip--empty' : ''}`;
        return pip;
      }));
      this.run.stats.hudWrites += 1;
    }

    if (changed.burst) {
      const burstActive = this.run.time < this.run.burst.activeUntil;
      const burstRatio = Math.min(1, this.run.burst.charge / this.run.burst.maxCharge);
      const burstReady = burstRatio >= 1 && !burstActive && this.run.state === 'running';
      this.elements.burstFill.style.transform = `scaleY(${burstRatio})`;
      this.elements.burstValue.textContent = burstActive
        ? `${Math.max(0, this.run.burst.activeUntil - this.run.time).toFixed(1)}s`
        : `${Math.round(burstRatio * 100)}%`;
      this.elements.burstButton.disabled = !burstReady;
      this.elements.burstButton.classList.toggle('burst-button--ready', burstReady);
      this.elements.burstButton.classList.toggle('burst-button--active', burstActive);
      this.run.stats.hudWrites += 5;
    }
    if (!this.elements.eventBanner.hidden && this.run.time >= this.bannerUntil) {
      this.elements.eventBanner.hidden = true;
      this.run.stats.hudWrites += 1;
    }

    if (changed.weapons) {
      const reactionIds = this.run.fusionSlots;
      const reactionHints = [];
      if (this.run.fusionSlots.length < 2 && !this.run.unlockedReactions.fireTornado && this.run.weapons.fireball && this.run.weapons.windBlade) {
        reactionHints.push('火 + 风 → 火焰龙卷｜持续环绕');
      }
      if (this.run.fusionSlots.length < 2 && !this.run.unlockedReactions.thermalShock && this.run.weapons.fireball && this.run.weapons.iceShard) {
        reactionHints.push('火 + 冰 → 霜爆｜减速后引爆');
      }
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
      for (const [weaponId, behavior] of Object.entries(this.run.weaponMutations)) {
        const mutation = CONFIG.upgrades.find((upgrade) => (
          upgrade.kind === 'mutation' && upgrade.weapon === weaponId && upgrade.behavior === behavior
        ));
        if (!mutation) continue;
        const chip = this.document.createElement('span');
        chip.className = 'weapon-chip weapon-chip--mutation';
        chip.textContent = mutation.name;
        chips.push(chip);
      }
      for (const [id, rank] of Object.entries(this.run.masteries)) {
        const mastery = CONFIG.upgrades.find((upgrade) => upgrade.id === id);
        if (!mastery) continue;
        const chip = this.document.createElement('span');
        chip.className = 'weapon-chip weapon-chip--mastery';
        chip.textContent = `${mastery.name} ×${rank}`;
        chips.push(chip);
      }
      for (const hint of reactionHints) {
        const chip = this.document.createElement('span');
        chip.className = 'weapon-chip weapon-chip--hint';
        chip.textContent = hint;
        chips.push(chip);
      }
      this.elements.weapons.replaceChildren(...chips);
      this.run.stats.hudWrites += 1;
    }
  }

  announce(message) {
    this.elements.status.textContent = message;
  }

  showBattleEvents(events) {
    const event = [...events].reverse().find(({ type }) => (
      type === 'worldRule' || type === 'eliteSpawn' || type === 'burstActivate'
    ));
    if (!event) return;
    const ruleLabels = {
      surgingHorde: '汹涌怪潮：敌群密度提升',
      hardenedShell: '硬化外壳：敌人生命强化',
      volatilePursuit: '狂暴追猎：敌人速度强化',
    };
    const bannerText = event.type === 'worldRule'
      ? `世界法则 ${event.level} · ${ruleLabels[event.rule] ?? event.rule}`
      : event.type === 'eliteSpawn' ? '精英入侵 · 击破可获得高阶核心' : '元素爆发 · 全能力超载';
    if (this.elements.eventBanner.textContent !== bannerText) {
      this.elements.eventBanner.textContent = bannerText;
      this.run.stats.hudWrites += 1;
    }
    if (this.elements.eventBanner.hidden) {
      this.elements.eventBanner.hidden = false;
      this.run.stats.hudWrites += 1;
    }
    this.bannerUntil = this.run.time + (event.type === 'worldRule' ? 4 : 2.4);
  }

  renderLeaderboard(container, entries) {
    if (!container) return;
    if (entries.length === 0) {
      const empty = this.document.createElement('li');
      empty.textContent = '尚无记录，第一局由你定义。';
      container.replaceChildren(empty);
      return;
    }
    container.replaceChildren(...entries.map((entry, index) => {
      const item = this.document.createElement('li');
      item.textContent = `#${index + 1}  ${formatTime(entry.time)} · ${entry.kills} 击杀 · Lv.${entry.level}`;
      return item;
    }));
  }

  installTestSnapshot() {
    if (new URLSearchParams(location.search).get('test') !== '1') return;
    Object.defineProperty(window, '__ELEMENTAL_SURVIVOR__', {
      configurable: false,
      value: Object.freeze({
        sustain: () => {
          if (!['running', 'levelUp', 'paused'].includes(this.run.state)) return false;
          this.run.player.health = this.run.player.maxHealth;
          return true;
        },
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
          enemies: this.run.enemies.map(({ id, type, x, y, radius, elite }) => ({ id, type, x, y, radius, elite })),
          projectileCount: this.run.projectiles.length,
          xpOrbCount: this.run.xpOrbs.length,
          xpOrbs: this.run.xpOrbs.map(({ id, x, y, value, tier }) => ({ id, x, y, value, tier })),
          particleCount: this.run.particles.length,
          weapons: Object.keys(this.run.weapons),
          reactions: Object.keys(this.run.unlockedReactions),
          fusionSlots: [...this.run.fusionSlots],
          mutations: { ...this.run.weaponMutations },
          masteries: { ...this.run.masteries },
          burst: { ...this.run.burst },
          worldRules: [...this.run.worldRules],
          leaderboard: loadLeaderboard(),
          upgrades: [...this.run.stats.upgradePicks],
          stats: JSON.parse(JSON.stringify(this.run.stats)),
          loop: { running: this.loop.running, paused: this.loop.paused },
        }),
      }),
    });
  }
}
