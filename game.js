(() => {
  "use strict";

  const STORAGE_KEY = "mch_cryptid_guard_test_v3";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const screens = {
    start: document.getElementById("startScreen"),
    how: document.getElementById("howScreen"),
    game: document.getElementById("gameScreen"),
    upgrade: document.getElementById("upgradeScreen"),
    result: document.getElementById("resultScreen"),
  };

  const ui = {
    time: document.getElementById("timeText"),
    hp: document.getElementById("hpText"),
    ce: document.getElementById("ceText"),
    score: document.getElementById("scoreText"),
    best: document.getElementById("bestScore"),
    resultTitle: document.getElementById("resultTitle"),
    resultSummary: document.getElementById("resultSummary"),
    resultStats: document.getElementById("resultStats"),
    upgradeOptions: document.getElementById("upgradeOptions"),
    upgradeHint: document.getElementById("upgradeHint"),
    stick: document.getElementById("stick"),
    knob: document.getElementById("knob"),
    gameScreen: document.getElementById("gameScreen"),
    stickSideBtn: document.getElementById("stickSideBtn"),
  };

  const W = 960;
  const H = 540;
  let scale = 1;
  let dpr = 1;
  let last = 0;
  let selectedHero = "balanced";
  let state = null;
  let mode = "start";
  let pausedForUpgrade = false;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const angleTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);

  function loadSave() {
    try { return { best: 0, plays: 0, stickSide: "right", ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; }
    catch { return { best: 0, plays: 0, stickSide: "right" }; }
  }
  function save(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  function updateBestText() {
    const s = loadSave();
    ui.best.textContent = `最高スコア: ${s.best || 0} / プレイ回数: ${s.plays || 0}`;
    applyStickSide(s.stickSide || "right");
  }

  function applyStickSide(side) {
    const chosen = side === "left" ? "left" : "right";
    document.body.classList.toggle("stick-right", chosen === "right");
    document.body.classList.toggle("stick-left", chosen === "left");
    if (ui.stickSideBtn) ui.stickSideBtn.textContent = `操作パッド: ${chosen === "right" ? "右" : "左"}`;
  }

  function toggleStickSide() {
    const saved = loadSave();
    saved.stickSide = (saved.stickSide || "right") === "right" ? "left" : "right";
    save(saved);
    applyStickSide(saved.stickSide);
  }

  const heroDefs = {
    balanced: { icon: "⚔", speed: 210, range: 165, fireRate: 0.68, damage: 14, color: "#83d6ff", magnet: 100 },
    swift: { icon: "✦", speed: 252, range: 145, fireRate: 0.62, damage: 11, color: "#91f0aa", magnet: 130 },
    guardian: { icon: "◆", speed: 182, range: 150, fireRate: 0.78, damage: 13, color: "#ffd166", magnet: 92, aura: true },
    sage: { icon: "☄", speed: 192, range: 215, fireRate: 0.88, damage: 18, color: "#c8a2ff", magnet: 98 },
  };

  const enemyDefs = {
    walker: { cost: 1, hp: 20, speed: 36, damage: 3, radius: 12, color: "#ff7979", score: 12 },
    runner: { cost: 3, hp: 16, speed: 70, damage: 3, radius: 10, color: "#ffb86b", score: 18 },
    archer: { cost: 5, hp: 24, speed: 24, damage: 3, radius: 12, color: "#f78bd8", score: 28, ranged: true, range: 250, cooldown: 2.6 },
    splitter: { cost: 6, hp: 38, speed: 30, damage: 4, radius: 15, color: "#a3e635", score: 35, split: true },
    hexer: { cost: 7, hp: 30, speed: 31, damage: 2, radius: 13, color: "#b58cff", score: 42, debuff: true },
  };

  const upgrades = {
    orbit: { name: "護衛リング", desc: "周囲を回る弾を1つ追加。近づく敵に強い。", apply: s => s.player.orbits++ },
    range: { name: "索敵拡張", desc: "自動攻撃の射程が広がる。遠距離敵を処理しやすい。", apply: s => s.player.range += 42 },
    haste: { name: "俊足", desc: "移動速度とCE回収範囲が上がる。", apply: s => { s.player.speed += 28; s.player.magnet += 24; } },
    wall: { name: "結界", desc: "クリプタイドの周囲に防衛弾を追加。", apply: s => s.cryptid.wall++ },
    heal: { name: "再生", desc: "クリプタイドのHPを少し回復する。", apply: s => s.cryptid.hp = clamp(s.cryptid.hp + 22, 0, s.cryptid.maxHp) },
    slow: { name: "遅滞領域", desc: "クリプタイド周辺の敵を遅くする。", apply: s => s.cryptid.slow += 0.08 },
    pierce: { name: "貫通弾", desc: "通常攻撃が1体貫通。弾の威力は少し下がるが密集に強い。", apply: s => s.player.pierce++ },
    shotgun: { name: "散弾", desc: "近距離へ扇形に追加弾を放つ。大量の敵を押し返しやすい。", apply: s => s.player.shotgun++ },
    burst: { name: "CE爆発", desc: "CE取得時、近くの敵に小ダメージ。", apply: s => s.player.ceBurst += 7 },
    shield: { name: "緊急盾", desc: "大きな被害を一度だけ防ぐ盾を得る。", apply: s => s.cryptid.shields++ },
  };

  function setScreen(name) {
    Object.values(screens).forEach(el => el.classList.remove("active"));
    if (name === "upgrade") {
      screens.game.classList.add("active");
      screens.upgrade.classList.add("active");
    } else {
      screens[name].classList.add("active");
    }
    mode = name;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    scale = rect.width / W;
    document.documentElement.style.setProperty("--game-left", `${rect.left}px`);
    document.documentElement.style.setProperty("--game-top", `${rect.top}px`);
    document.documentElement.style.setProperty("--game-width", `${rect.width}px`);
    document.documentElement.style.setProperty("--game-height", `${rect.height}px`);
  }

  function newGame() {
    const base = heroDefs[selectedHero];
    state = {
      t: 0,
      duration: 180,
      score: 0,
      kills: 0,
      ce: 0,
      ceNeed: 6,
      phase: 0,
      spawnAcc: 0,
      threatMemory: [],
      warnings: [],
      enemies: [],
      bullets: [],
      gems: [],
      floaters: [],
      keys: {},
      stats: { enemyScore: 0, ceScore: 0, clearBonus: 0, hpBonus: 0, killBonus: 0, ceCollected: 0, upgrades: 0 },
      upgradeCounts: {},
      stick: { active: false, x: 0, y: 0 },
      player: { x: W / 2, y: H / 2 + 118, r: 14, ...base, fire: 0, orbits: base.aura ? 1 : 0, pierce: 0, ceBurst: 0, shotgun: 0 },
      cryptid: { x: W / 2, y: H / 2, r: 32, hp: 100, maxHp: 100, wall: 0, slow: 0, shields: 1, hitFlash: 0 },
      paused: false,
      ended: false,
    };
    pausedForUpgrade = false;
    setScreen("game");
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }

  function currentPhase(t) {
    if (t < 30) return 0;
    if (t < 60) return 1;
    if (t < 90) return 2;
    if (t < 120) return 3;
    if (t < 150) return 4;
    return 5;
  }

  function allowedEnemies(phase) {
    if (phase <= 0) return ["walker"];
    if (phase === 1) return ["walker", "runner"];
    if (phase === 2) return ["walker", "runner", "archer"];
    if (phase === 3) return ["walker", "runner", "archer", "splitter"];
    return ["walker", "runner", "archer", "splitter", "hexer"];
  }

  function spawnBudget(s) {
    const phase = currentPhase(s.t);
    let budget = 0.74 + phase * 0.62;
    if (phase >= 4) budget += 0.35;
    if (phase >= 5) budget += 0.55;
    if (s.t < 25) budget *= 0.72;
    if (s.cryptid.hp < 55) budget *= 0.78;
    if (s.cryptid.hp < 35) budget *= 0.58;
    if (s.enemies.length > 28) budget *= 0.35;
    if (s.enemies.length > 42) budget = 0;
    return budget;
  }

  function pickEnemy(s) {
    const phase = currentPhase(s.t);
    const allowed = allowedEnemies(phase);
    const recent = s.threatMemory.slice(-4);
    const heavyRecent = recent.filter(k => enemyDefs[k].cost >= 5).length;
    let pool = allowed.filter(k => !(enemyDefs[k].cost >= 5 && heavyRecent >= 2));
    if (s.cryptid.hp < 30) pool = pool.filter(k => k !== "hexer" && k !== "splitter");
    const weights = pool.map(k => {
      if (k === "walker") return Math.max(1, 5 - phase * 0.4);
      if (k === "runner") return 2 + phase * 0.2;
      if (k === "archer") return phase >= 2 ? 1.6 : 0;
      if (k === "splitter") return phase >= 3 ? 1.1 : 0;
      if (k === "hexer") return phase >= 4 ? 0.9 : 0;
      return 1;
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[0];
  }

  function spawnEnemy(type, forcedPos) {
    const def = enemyDefs[type];
    const side = Math.floor(rand(0, 4));
    let x, y;
    if (forcedPos) { x = forcedPos.x; y = forcedPos.y; }
    else if (side === 0) { x = rand(-40, W + 40); y = -30; }
    else if (side === 1) { x = W + 30; y = rand(-40, H + 40); }
    else if (side === 2) { x = rand(-40, W + 40); y = H + 30; }
    else { x = -30; y = rand(-40, H + 40); }
    const e = {
      type, x, y, r: def.radius, hp: def.hp, maxHp: def.hp,
      speed: def.speed, damage: def.damage, color: def.color, cd: rand(0.4, 1.2), warned: false,
    };
    if (def.ranged || def.debuff) {
      state.warnings.push({ x, y, text: def.ranged ? "遠距離敵" : "妨害敵", life: 1.25, color: def.ranged ? "#f78bd8" : "#b58cff" });
    }
    state.enemies.push(e);
    state.threatMemory.push(type);
    if (state.threatMemory.length > 8) state.threatMemory.shift();
  }

  function update(dt) {
    const s = state;
    if (!s || s.ended || pausedForUpgrade || s.paused) return;
    s.t += dt;
    s.phase = currentPhase(s.t);
    if (s.t >= s.duration) return endGame(true);

    movePlayer(s, dt);
    spawnSystem(s, dt);
    updatePlayerFire(s, dt);
    updateCryptidDefense(s, dt);
    updateEnemies(s, dt);
    updateBullets(s, dt);
    updateGems(s, dt);
    updateWarnings(s, dt);
    updateFloaters(s, dt);
    updateUI(s);
  }

  function movePlayer(s, dt) {
    let vx = 0, vy = 0;
    if (s.keys.ArrowLeft || s.keys.a) vx -= 1;
    if (s.keys.ArrowRight || s.keys.d) vx += 1;
    if (s.keys.ArrowUp || s.keys.w) vy -= 1;
    if (s.keys.ArrowDown || s.keys.s) vy += 1;
    if (s.stick.active) { vx += s.stick.x; vy += s.stick.y; }
    const len = Math.hypot(vx, vy) || 1;
    s.player.x = clamp(s.player.x + (vx / len) * s.player.speed * dt, 24, W - 24);
    s.player.y = clamp(s.player.y + (vy / len) * s.player.speed * dt, 34, H - 24);
  }

  function spawnSystem(s, dt) {
    s.spawnAcc += spawnBudget(s) * dt;
    let guard = 0;
    while (s.spawnAcc >= 1 && guard++ < 4) {
      const type = pickEnemy(s);
      const cost = enemyDefs[type].cost;
      if (s.spawnAcc >= Math.max(1, cost * 0.55)) {
        spawnEnemy(type);
        s.spawnAcc -= Math.max(1, cost * 0.55);
      } else break;
    }
  }

  function nearestEnemy(s, source, range) {
    let best = null, bd = Infinity;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - source.x, e.y - source.y);
      if (d < range && d < bd) { best = e; bd = d; }
    }
    return best;
  }

  function updatePlayerFire(s, dt) {
    s.player.fire -= dt;
    if (s.player.fire <= 0) {
      const target = nearestEnemy(s, s.player, s.player.range);
      if (target) {
        const a = angleTo(s.player, target);
        firePlayerShot(s, a);
        s.player.fire = s.player.fireRate;
      } else {
        s.player.fire = 0.08;
      }
    }
    for (let i = 0; i < s.player.orbits; i++) {
      const a = s.t * (1.8 + i * 0.13) + (Math.PI * 2 * i) / Math.max(1, s.player.orbits);
      const ox = s.player.x + Math.cos(a) * 42;
      const oy = s.player.y + Math.sin(a) * 42;
      for (const e of s.enemies) {
        if (Math.hypot(e.x - ox, e.y - oy) < e.r + 9) {
          e.hp -= 18 * dt;
        }
      }
    }
  }

  function firePlayerShot(s, a) {
    const piercePenalty = clamp(1 - s.player.pierce * 0.05, 0.72, 1);
    const baseDamage = s.player.damage * piercePenalty;
    s.bullets.push({ x: s.player.x, y: s.player.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 5, damage: baseDamage, life: 1.22, pierce: s.player.pierce, color: s.player.color, owner: "player" });
    if (s.player.shotgun > 0) {
      const pellets = Math.min(2 + s.player.shotgun * 2, 8);
      const spread = Math.min(0.32 + s.player.shotgun * 0.06, 0.62);
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0 : i / (pellets - 1);
        const aa = a - spread / 2 + spread * t;
        s.bullets.push({ x: s.player.x, y: s.player.y, vx: Math.cos(aa) * 340, vy: Math.sin(aa) * 340, r: 4, damage: 6 + s.player.shotgun * 1.2, life: 0.78, pierce: 0, color: "#ffd166", owner: "player" });
      }
    }
  }

  function updateCryptidDefense(s, dt) {
    if (s.cryptid.hitFlash > 0) s.cryptid.hitFlash -= dt;
    for (let i = 0; i < s.cryptid.wall; i++) {
      const a = -s.t * (1.2 + i * 0.05) + (Math.PI * 2 * i) / Math.max(1, s.cryptid.wall);
      const ox = s.cryptid.x + Math.cos(a) * 56;
      const oy = s.cryptid.y + Math.sin(a) * 56;
      for (const e of s.enemies) {
        if (Math.hypot(e.x - ox, e.y - oy) < e.r + 8) e.hp -= 22 * dt;
      }
    }
  }

  function updateEnemies(s, dt) {
    const c = s.cryptid;
    for (let i = s.enemies.length - 1; i >= 0; i--) {
      const e = s.enemies[i];
      const def = enemyDefs[e.type];
      const dToC = Math.hypot(e.x - c.x, e.y - c.y);
      const slow = dToC < 120 ? clamp(1 - c.slow, 0.55, 1) : 1;

      if (def.ranged && dToC < def.range) {
        e.cd -= dt;
        if (e.cd <= 0) {
          const a = angleTo(e, c);
          s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 4, damage: def.damage, life: 2.2, color: def.color, owner: "enemy" });
          e.cd = def.cooldown;
          s.warnings.push({ x: c.x, y: c.y - 52, text: "狙撃", life: 0.65, color: def.color });
        }
      } else if (def.debuff && dToC < 135) {
        e.cd -= dt;
        if (e.cd <= 0) {
          damageCryptid(s, 2);
          s.warnings.push({ x: c.x, y: c.y - 68, text: "防御低下", life: 0.75, color: def.color });
          e.cd = 2.4;
        }
      } else {
        const a = Math.atan2(c.y - e.y, c.x - e.x);
        e.x += Math.cos(a) * e.speed * slow * dt;
        e.y += Math.sin(a) * e.speed * slow * dt;
      }

      if (dToC < e.r + c.r) {
        damageCryptid(s, e.damage);
        killEnemy(s, i, false);
        continue;
      }
      if (e.hp <= 0) killEnemy(s, i, true);
    }
  }

  function updateBullets(s, dt) {
    for (let i = s.bullets.length - 1; i >= 0; i--) {
      const b = s.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -80 || b.x > W + 80 || b.y < -80 || b.y > H + 80) { s.bullets.splice(i, 1); continue; }
      if (b.owner === "player") {
        for (let j = s.enemies.length - 1; j >= 0; j--) {
          const e = s.enemies[j];
          if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
            e.hp -= b.damage;
            if (b.pierce > 0) b.pierce--; else { s.bullets.splice(i, 1); }
            if (e.hp <= 0) killEnemy(s, j, true);
            break;
          }
        }
      } else {
        if (Math.hypot(s.cryptid.x - b.x, s.cryptid.y - b.y) < s.cryptid.r + b.r) {
          damageCryptid(s, b.damage);
          s.bullets.splice(i, 1);
        }
      }
    }
  }

  function killEnemy(s, index, reward) {
    const e = s.enemies[index];
    s.enemies.splice(index, 1);
    if (!reward) return;
    const def = enemyDefs[e.type];
    s.kills++;
    s.score += def.score;
    s.stats.enemyScore += def.score;
    s.gems.push({ x: e.x, y: e.y, r: 6, value: def.cost >= 5 ? 4 : 2, life: 20 });
    s.floaters.push({ x: e.x, y: e.y, text: `+${def.score}`, life: 0.8, color: "#ffd166" });
    if (def.split) {
      for (let k = 0; k < 2; k++) spawnEnemy("walker", { x: e.x + rand(-18, 18), y: e.y + rand(-18, 18) });
    }
  }

  function damageCryptid(s, amount) {
    if (s.t < 35) amount *= 0.65;
    if (s.cryptid.shields > 0 && amount >= 4) {
      s.cryptid.shields--;
      s.floaters.push({ x: s.cryptid.x, y: s.cryptid.y - 42, text: "SHIELD", life: 0.9, color: "#83d6ff" });
      return;
    }
    s.cryptid.hp = clamp(s.cryptid.hp - amount, 0, s.cryptid.maxHp);
    s.cryptid.hitFlash = 0.2;
    if (s.cryptid.hp <= 0) endGame(false);
  }

  function updateGems(s, dt) {
    for (let i = s.gems.length - 1; i >= 0; i--) {
      const g = s.gems[i];
      g.life -= dt;
      const d = Math.hypot(g.x - s.player.x, g.y - s.player.y);
      if (d < s.player.magnet) {
        const a = Math.atan2(s.player.y - g.y, s.player.x - g.x);
        g.x += Math.cos(a) * (160 + (s.player.magnet - d) * 3.2) * dt;
        g.y += Math.sin(a) * (160 + (s.player.magnet - d) * 3.2) * dt;
      }
      if (d < s.player.r + 9) {
        s.ce += g.value;
        s.score += g.value * 5;
        s.stats.ceScore += g.value * 5;
        s.stats.ceCollected += g.value;
        if (s.player.ceBurst > 0) {
          for (const e of s.enemies) if (Math.hypot(e.x - g.x, e.y - g.y) < 80) e.hp -= s.player.ceBurst;
        }
        s.gems.splice(i, 1);
        if (s.ce >= s.ceNeed) openUpgrade();
      } else if (g.life <= 0) s.gems.splice(i, 1);
    }
  }

  function updateWarnings(s, dt) {
    for (let i = s.warnings.length - 1; i >= 0; i--) {
      s.warnings[i].life -= dt;
      if (s.warnings[i].life <= 0) s.warnings.splice(i, 1);
    }
  }
  function updateFloaters(s, dt) {
    for (let i = s.floaters.length - 1; i >= 0; i--) {
      const f = s.floaters[i]; f.life -= dt; f.y -= 30 * dt;
      if (f.life <= 0) s.floaters.splice(i, 1);
    }
  }

  function chooseUpgradeCandidates(s) {
    const ids = new Set();
    if (s.cryptid.hp < 55) ids.add("heal");
    if (s.enemies.length > 24) ids.add("orbit");
    if (s.enemies.length > 18) ids.add("shotgun");
    if (s.enemies.some(e => e.type === "archer")) ids.add("range");
    if (s.cryptid.hp < 35) ids.add("shield");
    const all = Object.keys(upgrades);
    while (ids.size < 3) ids.add(all[Math.floor(Math.random() * all.length)]);
    return Array.from(ids).slice(0, 3);
  }

  function openUpgrade() {
    pausedForUpgrade = true;
    const candidates = chooseUpgradeCandidates(state);
    ui.upgradeOptions.innerHTML = "";
    ui.upgradeHint.textContent = state.cryptid.hp < 45 ? "クリプタイドが危険です。守りを厚くする候補を含めています。" : "現在の敵構成を見て候補を出しています。";
    for (const id of candidates) {
      const u = upgrades[id];
      const btn = document.createElement("button");
      btn.className = "upgrade-card";
      btn.innerHTML = `<b>${u.name}</b><small>${u.desc}</small>`;
      btn.addEventListener("click", () => {
        u.apply(state);
        state.upgradeCounts[id] = (state.upgradeCounts[id] || 0) + 1;
        state.stats.upgrades++;
        state.ce -= state.ceNeed;
        state.ceNeed = Math.floor(state.ceNeed * 1.15 + 3);
        pausedForUpgrade = false;
        screens.upgrade.classList.remove("active");
        mode = "game";
        updateUI(state);
        last = performance.now();
        requestAnimationFrame(loop);
      });
      ui.upgradeOptions.appendChild(btn);
    }
    setScreen("upgrade");
  }

  function updateUI(s) {
    const remain = Math.max(0, Math.ceil(s.duration - s.t));
    ui.time.textContent = `${String(Math.floor(remain / 60)).padStart(2, "0")}:${String(remain % 60).padStart(2, "0")}`;
    ui.hp.textContent = `${Math.ceil(s.cryptid.hp)}%`;
    ui.ce.textContent = `${Math.floor(s.ce)}/${s.ceNeed}`;
    ui.score.textContent = `${Math.floor(s.score)}`;
  }

  function endGame(win) {
    if (!state || state.ended) return;
    state.ended = true;
    state.stats.clearBonus = win ? 900 : 0;
    state.stats.hpBonus = Math.floor(Math.max(0, state.cryptid.hp) * 12);
    state.stats.killBonus = state.kills * 3;
    const finalScore = Math.floor(state.score + state.stats.clearBonus + state.stats.hpBonus + state.stats.killBonus);
    const saved = loadSave();
    saved.plays = (saved.plays || 0) + 1;
    saved.best = Math.max(saved.best || 0, finalScore);
    save(saved);
    ui.resultTitle.textContent = win ? "防衛成功" : "防衛失敗";
    ui.resultSummary.textContent = win ? "クリプタイドを守り切りました。" : "クリプタイドが倒されました。次は危険な敵を早めに処理してください。";
    const build = Object.entries(state.upgradeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${upgrades[id].name}-${n}`)
      .join(" / ") || "なし";
    ui.resultStats.innerHTML = `
      <div><b>スコア</b>${finalScore}</div>
      <div><b>最高スコア</b>${saved.best}</div>
      <div><b>討伐数</b>${state.kills}</div>
      <div><b>回収CE</b>${state.stats.ceCollected}</div>
      <div><b>撃破点</b>${state.stats.enemyScore}</div>
      <div><b>CE点</b>${state.stats.ceScore}</div>
      <div><b>防衛点</b>${state.stats.clearBonus + state.stats.hpBonus}</div>
      <div><b>ビルド</b>${build}</div>
      <div class="wide"><b>共有用</b>Score ${finalScore} / ${build}</div>
    `;
    updateBestText();
    setScreen("result");
  }

  function draw() {
    if (!state) return;
    const s = state;
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W/2, H/2, 20, W/2, H/2, 520);
    g.addColorStop(0, "#1b2a43");
    g.addColorStop(1, "#090b12");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawGrid(s);
    drawCryptid(s);
    for (const gem of s.gems) drawGem(gem);
    for (const e of s.enemies) drawEnemy(e);
    for (const b of s.bullets) drawBullet(b);
    drawPlayer(s);
    for (const w of s.warnings) drawWarning(w);
    for (const f of s.floaters) drawFloater(f);
    if (s.paused) drawCenterText("PAUSE");
  }

  function drawGrid(s) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = "#83d6ff";
    ctx.lineWidth = 1;
    const off = (s.t * 18) % 42;
    for (let x = -42 + off; x < W + 42; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = -42 + off; y < H + 42; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }
  function circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function drawCryptid(s) {
    const c = s.cryptid;
    ctx.save();
    ctx.shadowColor = c.hitFlash > 0 ? "#ff7979" : "#83d6ff";
    ctx.shadowBlur = 24;
    circle(c.x, c.y, c.r, c.hitFlash > 0 ? "#ff7979" : "#235b78");
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#83d6ff"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "24px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("◇", c.x, c.y + 1);
    if (c.slow > 0) { ctx.globalAlpha = 0.12; circle(c.x, c.y, 120, "#83d6ff"); }
    for (let i = 0; i < c.wall; i++) { const a = -s.t * (1.2 + i * 0.05) + (Math.PI * 2 * i) / Math.max(1, c.wall); circle(c.x + Math.cos(a)*56, c.y + Math.sin(a)*56, 8, "#83d6ff"); }
    ctx.restore();
  }
  function drawPlayer(s) {
    const p = s.player;
    ctx.save();
    circle(p.x, p.y, p.r + 5, "rgba(255,255,255,0.08)");
    circle(p.x, p.y, p.r, p.color);
    ctx.fillStyle = "#06101a"; ctx.font = "20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.icon, p.x, p.y + 1);
    ctx.globalAlpha = 0.12; circle(p.x, p.y, p.range, p.color); ctx.globalAlpha = 1;
    for (let i = 0; i < p.orbits; i++) { const a = s.t*(1.8+i*0.13)+(Math.PI*2*i)/Math.max(1,p.orbits); circle(p.x+Math.cos(a)*42, p.y+Math.sin(a)*42, 7, "#ffd166"); }
    ctx.restore();
  }
  function drawEnemy(e) {
    ctx.save();
    circle(e.x, e.y, e.r, e.color);
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5; ctx.stroke();
    const w = e.r * 2.2;
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(e.x - w/2, e.y - e.r - 10, w, 4);
    ctx.fillStyle = "#91f0aa"; ctx.fillRect(e.x - w/2, e.y - e.r - 10, w * clamp(e.hp / e.maxHp, 0, 1), 4);
    ctx.restore();
  }
  function drawBullet(b) { circle(b.x, b.y, b.r, b.color); }
  function drawGem(g) { circle(g.x, g.y, g.r + Math.sin(performance.now()/110)*1.2, "#5eead4"); }
  function drawWarning(w) {
    ctx.save(); ctx.globalAlpha = clamp(w.life, 0, 1); ctx.fillStyle = w.color; ctx.font = "bold 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(w.text, w.x, w.y); ctx.restore();
  }
  function drawFloater(f) { ctx.save(); ctx.globalAlpha = clamp(f.life,0,1); ctx.fillStyle = f.color; ctx.font = "bold 15px system-ui"; ctx.textAlign = "center"; ctx.fillText(f.text, f.x, f.y); ctx.restore(); }
  function drawCenterText(text) { ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0,0,W,H); ctx.fillStyle = "#fff"; ctx.font = "bold 42px system-ui"; ctx.textAlign = "center"; ctx.fillText(text, W/2, H/2); }

  function loop(now) {
    if (!state || state.ended || mode !== "game") return;
    const dt = Math.min(0.033, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    draw();
    if (!pausedForUpgrade && state && !state.ended && mode === "game") requestAnimationFrame(loop);
  }

  document.querySelectorAll(".hero-card").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".hero-card").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedHero = btn.dataset.hero;
    });
  });
  document.getElementById("startBtn").addEventListener("click", newGame);
  document.getElementById("howBtn").addEventListener("click", () => setScreen("how"));
  if (ui.stickSideBtn) ui.stickSideBtn.addEventListener("click", toggleStickSide);
  document.getElementById("backBtn").addEventListener("click", () => setScreen("start"));
  document.getElementById("retryBtn").addEventListener("click", newGame);
  document.getElementById("titleBtn").addEventListener("click", () => { updateBestText(); setScreen("start"); });
  document.getElementById("pauseBtn").addEventListener("click", () => { if (!state || pausedForUpgrade) return; state.paused = !state.paused; last = performance.now(); if (!state.paused) requestAnimationFrame(loop); draw(); });

  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", () => setTimeout(resize, 250));
  document.addEventListener("selectstart", e => e.preventDefault());
  document.addEventListener("dragstart", e => e.preventDefault());
  document.addEventListener("contextmenu", e => { if (mode === "game") e.preventDefault(); });
  document.addEventListener("touchmove", e => { if (mode === "game") e.preventDefault(); }, { passive: false });
  window.addEventListener("keydown", e => { if (state) state.keys[e.key] = true; if (e.key === "Escape" && state) state.paused = !state.paused; });
  window.addEventListener("keyup", e => { if (state) state.keys[e.key] = false; });

  function setupStick() {
    const stick = ui.stick, knob = ui.knob;
    const reset = () => { if (!state) return; state.stick.active = false; state.stick.x = 0; state.stick.y = 0; knob.style.transform = "translate(0px,0px)"; };
    stick.addEventListener("pointerdown", e => { e.preventDefault(); stick.setPointerCapture(e.pointerId); if (state) state.stick.active = true; updateStick(e); });
    stick.addEventListener("pointermove", e => { e.preventDefault(); updateStick(e); });
    stick.addEventListener("pointerup", e => { e.preventDefault(); reset(); });
    stick.addEventListener("pointercancel", e => { e.preventDefault(); reset(); });
    function updateStick(e) {
      if (!state || !state.stick.active) return;
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const len = Math.hypot(dx, dy), max = 34;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      state.stick.x = dx / max; state.stick.y = dy / max;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  setupStick();
  updateBestText();
  resize();
})();
