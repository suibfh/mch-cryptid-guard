(() => {
  "use strict";

  const STORAGE_KEY = "mch_yoshka_guard_test_v5";
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
    goldChestBtn: document.getElementById("goldChestBtn"),
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

  const assetPaths = {
    background: "Image/Backgrounds/1001.png",
    yoshka: "Image/Enemies/171.png",
    yoshkaOni: "Image/Enemies/172.png",
    heroes: {
      balanced: "Image/Heroes/2005.png",
      swift: "Image/Heroes/2003.png",
      guardian: "Image/Heroes/2002.png",
      sage: "Image/Heroes/2001.png",
    },
    enemies: {
      walker: "Image/Enemies/101.png",
      runner: "Image/Enemies/102.png",
      archer: "Image/Enemies/103.png",
      splitter: "Image/Enemies/104.png",
      hexer: "Image/Enemies/105.png",
    },
    oniEnemies: {
      walker: "Image/Enemies/141.png",
      runner: "Image/Enemies/143.png",
      archer: "Image/Enemies/145.png",
      splitter: "Image/Enemies/147.png",
      hexer: "Image/Enemies/156.png",
    },
    upgrades: {
      orbit: "Image/Extensions/2192.png",
      wall: "Image/Extensions/2147.png",
      pierce: "Image/Extensions/2187.png",
      shotgun: "Image/Extensions/2183.png",
      burst: "Image/Extensions/2121.png",
      range: "Image/Extensions/2098.png",
      haste: "Image/Extensions/2031.png",
      slow: "Image/Extensions/2179.png",
      heal: "Image/Extensions/2129.png",
      shield: "Image/Extensions/2010.png",
    },
    evolutions: {
      holyShot: "Image/Extensions/5002.png",
      pierceShotgun: "Image/Extensions/5035.png",
      whirlOrbit: "Image/Extensions/5143.png",
      sanctuary: "Image/Extensions/5147.png",
    }
  };
  const imageCache = new Map();
  function loadImage(path) {
    if (!path) return null;
    if (imageCache.has(path)) return imageCache.get(path);
    const img = new Image();
    img.draggable = false;
    img._ready = false;
    img._warned = false;
    img.onload = () => { img._ready = true; img._error = false; };
    img.onerror = () => {
      img._error = true;
      if (!img._warned) {
        console.warn(`[asset missing] ${path}`);
        img._warned = true;
      }
    };
    img.src = path;
    imageCache.set(path, img);
    return img;
  }
  function drawAsset(path, x, y, w, h) {
    const img = loadImage(path);
    if (img && img._ready) { ctx.drawImage(img, x - w / 2, y - h / 2, w, h); return true; }
    return false;
  }
  Object.values(assetPaths.heroes).forEach(loadImage);
  Object.values(assetPaths.enemies).forEach(loadImage);
  Object.values(assetPaths.oniEnemies).forEach(loadImage);
  Object.values(assetPaths.upgrades).forEach(loadImage);
  Object.values(assetPaths.evolutions).forEach(loadImage);
  [assetPaths.background, assetPaths.yoshka, assetPaths.yoshkaOni].forEach(loadImage);


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
    balanced: { name: "グリム兄弟", asset: assetPaths.heroes.balanced, icon: "⚔", speed: 210, range: 165, fireRate: 0.68, damage: 14, color: "#83d6ff", magnet: 100 },
    swift: { name: "ジャックザリッパー", asset: assetPaths.heroes.swift, icon: "✦", speed: 252, range: 145, fireRate: 0.62, damage: 11, color: "#91f0aa", magnet: 130 },
    guardian: { name: "スパルタクス", asset: assetPaths.heroes.guardian, icon: "◆", speed: 182, range: 150, fireRate: 0.78, damage: 13, color: "#ffd166", magnet: 92, aura: true },
    sage: { name: "ライト兄弟", asset: assetPaths.heroes.sage, icon: "☄", speed: 192, range: 215, fireRate: 0.88, damage: 18, color: "#c8a2ff", magnet: 98 },
  };

  const enemyDefs = {
    walker: { name: "クリーパー ショート", oniName: "クリーパー トール ドッピオ", cost: 1, hp: 20, oniHp: 32, speed: 36, oniSpeed: 48, damage: 3, oniDamage: 5, radius: 12, color: "#ff7979", score: 12, oniScore: 42 },
    runner: { name: "クリーパー トール", oniName: "クリーパー グランデ ドッピオ", cost: 3, hp: 16, oniHp: 36, speed: 70, oniSpeed: 82, damage: 3, oniDamage: 5, radius: 10, color: "#ffb86b", score: 18, oniScore: 62 },
    archer: { name: "クリーパー グランデ", oniName: "クリーパー ヴェンティ ドッピオ", cost: 5, hp: 24, oniHp: 52, speed: 24, oniSpeed: 35, damage: 3, oniDamage: 5, radius: 12, color: "#f78bd8", score: 28, oniScore: 92, ranged: true, range: 250, cooldown: 2.6 },
    splitter: { name: "クリーパー ヴェンティ", oniName: "クリーパー フラペチーノ ドッピオ", cost: 6, hp: 38, oniHp: 74, speed: 30, oniSpeed: 44, damage: 4, oniDamage: 6, radius: 15, color: "#a3e635", score: 35, oniScore: 126, split: true },
    hexer: { name: "クリーパー マキアート", oniName: "ハートブリード フラペチーノ ドッピオ", cost: 8, hp: 54, oniHp: 96, speed: 42, oniSpeed: 54, damage: 5, oniDamage: 7, radius: 15, color: "#b58cff", score: 86, oniScore: 170, debuff: true },
  };

  const upgrades = {
    orbit: { name: "チャクラム", asset: assetPaths.upgrades.orbit, desc: "周囲を回る弾を1つ追加。近づく敵に強いエクステンション。", apply: s => s.player.orbits++ },
    range: { name: "ギョク", asset: assetPaths.upgrades.range, desc: "自動攻撃の射程が広がる。遠距離敵を処理しやすい。", apply: s => s.player.range += 42 },
    haste: { name: "ブーツ", asset: assetPaths.upgrades.haste, desc: "移動速度とCE回収範囲が上がる。", apply: s => { s.player.speed += 28; s.player.magnet += 24; } },
    wall: { name: "シールドシステム", asset: assetPaths.upgrades.wall, desc: "ヨシュカの周囲に防衛弾を追加するエクステンション。", apply: s => s.cryptid.wall++ },
    heal: { name: "パンケーキ", asset: assetPaths.upgrades.heal, desc: "ヨシュカのHPを少し回復する。", apply: s => s.cryptid.hp = clamp(s.cryptid.hp + 22, 0, s.cryptid.maxHp) },
    slow: { name: "籠罠", asset: assetPaths.upgrades.slow, desc: "ヨシュカ周辺の敵を遅くする。", apply: s => s.cryptid.slow += 0.08 },
    pierce: { name: "ジャベリン", asset: assetPaths.upgrades.pierce, desc: "通常攻撃が1体貫通。弾の威力は少し下がるが密集に強い。", apply: s => s.player.pierce++ },
    shotgun: { name: "フレイル", asset: assetPaths.upgrades.shotgun, desc: "近距離へ扇形に追加弾を放つ。大量の敵を押し返しやすい。", apply: s => s.player.shotgun++ },
    burst: { name: "実はミサイル", asset: assetPaths.upgrades.burst, desc: "CE取得時、近くの敵に小ダメージ。", apply: s => s.player.ceBurst += 7 },
    shield: { name: "シールド", asset: assetPaths.upgrades.shield, desc: "大きな被害を一度だけ防ぐ盾を得る。", apply: s => s.cryptid.shields++ },
  };


  const evolutionDefs = {
    holyShot: {
      name: "グランダルメ",
      asset: assetPaths.evolutions.holyShot,
      condition: s => (s.upgradeCounts.shotgun || 0) >= 3 && (s.upgradeCounts.range || 0) >= 1,
      desc: "フレイルLv3 + ギョクLv1。フレイルの弾数、射程、広がりが上がる。"
    },
    pierceShotgun: {
      name: "バリスタ",
      asset: assetPaths.evolutions.pierceShotgun,
      condition: s => (s.upgradeCounts.pierce || 0) >= 3 && (s.upgradeCounts.shotgun || 0) >= 2,
      desc: "ジャベリンLv3 + フレイルLv2。フレイルの一部が敵を貫通する。"
    },
    whirlOrbit: {
      name: "宇宙観測スフィア",
      asset: assetPaths.evolutions.whirlOrbit,
      condition: s => (s.upgradeCounts.orbit || 0) >= 3 && (s.upgradeCounts.haste || 0) >= 1,
      desc: "チャクラムLv3 + ブーツLv1。リングが増え、当たった敵を少し押し返す。"
    },
    sanctuary: {
      name: "アメノミナカヌシ",
      asset: assetPaths.evolutions.sanctuary,
      condition: s => (s.upgradeCounts.wall || 0) >= 3 && (s.upgradeCounts.slow || 0) >= 1,
      desc: "シールドシステムLv3 + 籠罠Lv1。ヨシュカ周辺に防衛領域を作る。"
    },
  };

  function setScreen(name) {
    Object.values(screens).forEach(el => el.classList.remove("active"));
    if (screens.result) screens.result.classList.remove("fallback-gold");
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
      oni: false,
      oniTime: 0,
      scoreMultiplier: 1,
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
      stats: { enemyScore: 0, ceScore: 0, clearBonus: 0, hpBonus: 0, killBonus: 0, oniBonus: 0, ceCollected: 0, upgrades: 0 },
      upgradeCounts: {},
      evolutions: {},
      evolutionBanner: null,
      stick: { active: false, x: 0, y: 0 },
      player: { x: W / 2, y: H / 2 + 118, r: 14, ...base, fire: 0, orbits: base.aura ? 1 : 0, pierce: 0, ceBurst: 0, shotgun: 0 },
      cryptid: { name: "ヨシュカ", oniName: "ヨシュカ チョコラート", x: W / 2, y: H / 2, r: 34, hp: 100, maxHp: 100, wall: 0, slow: 0, shields: 1, hitFlash: 0 },
      paused: false,
      ended: false,
    };
    pausedForUpgrade = false;
    setScreen("game");
    resize();
    last = performance.now();
    requestAnimationFrame(loop);
  }


  function enterOniTime(s) {
    s.oni = true;
    s.oniTime = 0;
    s.scoreMultiplier = 2;
    s.cryptid.hp = Math.min(s.cryptid.maxHp, s.cryptid.hp + 18);
    s.evolutionBanner = { text: "鬼TIME", life: 3.0, oni: true };
    s.warnings.push({ x: W / 2, y: 78, text: "鬼TIME", life: 2.2, color: "#ff4b4b" });
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
    if (phase === 3) return ["walker", "runner", "archer", "splitter", "hexer"];
    return ["walker", "runner", "archer", "splitter", "hexer"];
  }

  function spawnBudget(s) {
    const phase = currentPhase(s.t);
    let budget = 0.74 + phase * 0.62;
    if (s.oni) budget = 5.2 + Math.min(12.0, s.oniTime * 0.24);
    if (phase >= 4) budget += 0.35;
    if (phase >= 5) budget += 0.55;
    if (s.t < 25) budget *= 0.72;
    if (!s.oni && s.cryptid.hp < 55) budget *= 0.78;
    if (!s.oni && s.cryptid.hp < 35) budget *= 0.58;
    if (!s.oni && s.enemies.length > 28) budget *= 0.35;
    if (!s.oni && s.enemies.length > 42) budget = 0;
    if (s.oni && s.enemies.length > 110) budget *= 0.45;
    if (s.oni && s.enemies.length > 170) budget = 0;
    return budget;
  }

  function pickEnemy(s) {
    const phase = currentPhase(s.t);
    if (s.oni) {
      const pool = ["walker", "runner", "archer", "splitter", "hexer"];
      const weights = pool.map(k => {
        if (k === "walker") return 1.6;
        if (k === "runner") return 2.2;
        if (k === "archer") return 2.25;
        if (k === "splitter") return 2.15 + Math.min(1.8, s.oniTime * 0.035);
        if (k === "hexer") return 1.85 + Math.min(2.0, s.oniTime * 0.04);
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
    const allowed = allowedEnemies(phase);
    const recent = s.threatMemory.slice(-4);
    const heavyRecent = recent.filter(k => enemyDefs[k].cost >= 5).length;
    let pool = allowed.filter(k => !(enemyDefs[k].cost >= 5 && heavyRecent >= 2));
    if (s.cryptid.hp < 30) pool = pool.filter(k => k !== "hexer" && k !== "splitter");
    const weights = pool.map(k => {
      if (k === "walker") return Math.max(1, 5 - phase * 0.4);
      if (k === "runner") return 2 + phase * 0.2;
      if (k === "archer") return phase >= 2 ? 1.8 : 0;
      if (k === "splitter") return phase >= 3 ? 1.45 : 0;
      if (k === "hexer") return phase >= 4 ? 2.1 : 0.9;
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
    const baseHp = state.oni ? (def.oniHp || def.hp * 1.8) : def.hp;
    const baseSpeed = state.oni ? (def.oniSpeed || def.speed * 1.25) : def.speed;
    const baseDamage = state.oni ? (def.oniDamage || def.damage * 1.5) : def.damage;
    const oniHpMult = state.oni ? 1.0 + Math.min(1.25, state.oniTime * 0.026) : 1;
    const oniSpeedMult = state.oni ? 1.0 + Math.min(0.42, state.oniTime * 0.009) : 1;
    const oniDamageMult = state.oni ? 1.0 + Math.min(0.45, state.oniTime * 0.009) : 1;
    const e = {
      type, x, y, r: def.radius, hp: baseHp * oniHpMult, maxHp: baseHp * oniHpMult,
      speed: baseSpeed * oniSpeedMult, damage: baseDamage * oniDamageMult, color: def.color, cd: rand(0.4, 1.2), warned: false, oni: state.oni,
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
    if (s.oni) s.oniTime += dt;
    s.phase = currentPhase(s.t);
    if (s.t >= s.duration && !s.oni) enterOniTime(s);

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
    while (s.spawnAcc >= 1 && guard++ < (s.oni ? 7 : 4)) {
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

  function canHit(e, key, t, cooldown) {
    if (!e.hitTimers) e.hitTimers = {};
    if ((e.hitTimers[key] || 0) > t) return false;
    e.hitTimers[key] = t + cooldown;
    return true;
  }

  function pushEnemyAway(e, source, power) {
    const a = Math.atan2(e.y - source.y, e.x - source.x);
    e.x = clamp(e.x + Math.cos(a) * power, -60, W + 60);
    e.y = clamp(e.y + Math.sin(a) * power, -60, H + 60);
  }

  function effectiveOrbitCount(s) {
    return s.player.orbits + (s.evolutions.whirlOrbit ? 2 : 0);
  }

  function effectiveWallCount(s) {
    return s.cryptid.wall + (s.evolutions.sanctuary ? 2 : 0);
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
    const orbitCount = effectiveOrbitCount(s);
    const orbitSpeed = s.evolutions.whirlOrbit ? 2.75 : 1.85;
    const orbitDamage = s.evolutions.whirlOrbit ? 10 : 7;
    const orbitCooldown = s.evolutions.whirlOrbit ? 0.22 : 0.28;
    const orbitHitRange = s.evolutions.whirlOrbit ? 17 : 14;
    for (let i = 0; i < orbitCount; i++) {
      const a = s.t * (orbitSpeed + i * 0.12) + (Math.PI * 2 * i) / Math.max(1, orbitCount);
      const ox = s.player.x + Math.cos(a) * 42;
      const oy = s.player.y + Math.sin(a) * 42;
      for (const e of s.enemies) {
        const key = `orbit${i}`;
        if (Math.hypot(e.x - ox, e.y - oy) < e.r + orbitHitRange && canHit(e, key, s.t, orbitCooldown)) {
          e.hp -= orbitDamage;
          if (s.evolutions.whirlOrbit) pushEnemyAway(e, s.player, 18);
          s.floaters.push({ x: e.x, y: e.y - e.r, text: `-${orbitDamage}`, life: 0.35, color: "#ffd166" });
        }
      }
    }
  }

  function firePlayerShot(s, a) {
    const piercePenalty = clamp(1 - s.player.pierce * 0.05, 0.72, 1);
    const baseDamage = s.player.damage * piercePenalty;
    s.bullets.push({ x: s.player.x, y: s.player.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, r: 5, damage: baseDamage, life: 1.22, pierce: s.player.pierce, color: s.player.color, owner: "player" });
    if (s.player.shotgun > 0) {
      let pellets = Math.min(2 + s.player.shotgun * 2, 8);
      let spread = Math.min(0.32 + s.player.shotgun * 0.06, 0.62);
      let pelletSpeed = 340;
      let pelletLife = 0.78;
      let pelletDamage = 6 + s.player.shotgun * 1.2;
      let pelletPierce = 0;
      let pelletColor = "#ffd166";
      if (s.evolutions.holyShot) {
        pellets += 2;
        spread += 0.16;
        pelletSpeed += 34;
        pelletLife += 0.18;
        pelletDamage += 1.2;
        pelletColor = "#fff0a6";
      }
      if (s.evolutions.pierceShotgun) {
        pelletPierce = 1;
        pelletDamage *= 0.9;
        pelletColor = "#ffdf7e";
      }
      for (let i = 0; i < pellets; i++) {
        const t = pellets === 1 ? 0 : i / (pellets - 1);
        const aa = a - spread / 2 + spread * t;
        s.bullets.push({ x: s.player.x, y: s.player.y, vx: Math.cos(aa) * pelletSpeed, vy: Math.sin(aa) * pelletSpeed, r: 4, damage: pelletDamage, life: pelletLife, pierce: pelletPierce, color: pelletColor, owner: "player" });
      }
    }
  }

  function updateCryptidDefense(s, dt) {
    if (s.cryptid.hitFlash > 0) s.cryptid.hitFlash -= dt;
    const wallCount = effectiveWallCount(s);
    const wallDamage = s.evolutions.sanctuary ? 10 : 8;
    const wallCooldown = s.evolutions.sanctuary ? 0.22 : 0.25;
    const wallHitRange = s.evolutions.sanctuary ? 16 : 13;
    for (let i = 0; i < wallCount; i++) {
      const a = -s.t * (1.35 + i * 0.06) + (Math.PI * 2 * i) / Math.max(1, wallCount);
      const ox = s.cryptid.x + Math.cos(a) * 56;
      const oy = s.cryptid.y + Math.sin(a) * 56;
      for (const e of s.enemies) {
        const key = `wall${i}`;
        if (Math.hypot(e.x - ox, e.y - oy) < e.r + wallHitRange && canHit(e, key, s.t, wallCooldown)) {
          e.hp -= wallDamage;
          s.floaters.push({ x: e.x, y: e.y - e.r, text: `-${wallDamage}`, life: 0.35, color: "#83d6ff" });
        }
      }
    }
    if (s.evolutions.sanctuary) {
      for (const e of s.enemies) {
        if (Math.hypot(e.x - s.cryptid.x, e.y - s.cryptid.y) < 124 && canHit(e, "sanctuary", s.t, 0.48)) {
          e.hp -= 6;
          s.floaters.push({ x: e.x, y: e.y - e.r, text: "聖域", life: 0.35, color: "#83d6ff" });
        }
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
    const baseScore = s.oni ? (def.oniScore || def.score * 2) : def.score;
    const gainedScore = Math.floor(baseScore * (s.scoreMultiplier || 1));
    s.score += gainedScore;
    s.stats.enemyScore += gainedScore;
    if (s.oni) s.stats.oniBonus += gainedScore - def.score;
    s.gems.push({ x: e.x, y: e.y, r: 6, value: (def.cost >= 5 ? 4 : 2) + (s.oni ? 1 : 0), life: 20 });
    s.floaters.push({ x: e.x, y: e.y, text: `+${gainedScore}`, life: 0.8, color: "#ffd166" });
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
    if (s.evolutionBanner) {
      s.evolutionBanner.life -= dt;
      if (s.evolutionBanner.life <= 0) s.evolutionBanner = null;
    }
    for (let i = s.floaters.length - 1; i >= 0; i--) {
      const f = s.floaters[i]; f.life -= dt; f.y -= 30 * dt;
      if (f.life <= 0) s.floaters.splice(i, 1);
    }
  }

  function checkEvolutions(s) {
    for (const [id, evo] of Object.entries(evolutionDefs)) {
      if (!s.evolutions[id] && evo.condition(s)) {
        s.evolutions[id] = true;
        const text = `覚醒! ${evo.name}`;
        s.evolutionBanner = { text, life: 2.2 };
        s.floaters.push({ x: W / 2, y: 92, text, life: 2.0, color: "#ffd166" });
      }
    }
  }

  function buildText(s) {
    const base = Object.entries(s.upgradeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${upgrades[id].name}-${n}`);
    const evos = Object.entries(s.evolutions || {})
      .filter(([, v]) => v)
      .map(([id]) => evolutionDefs[id].name);
    return [...evos, ...base].join(" / ") || "なし";
  }

  function evolutionProgressForUpgrade(s, upgradeId) {
    const after = { ...(s.upgradeCounts || {}) };
    after[upgradeId] = (after[upgradeId] || 0) + 1;
    const list = [];

    function entry(evoId, mainId, mainNeed, subId, subNeed) {
      const evo = evolutionDefs[evoId];
      if (!evo || s.evolutions[evoId]) return;
      const nowMain = s.upgradeCounts[mainId] || 0;
      const nowSub = s.upgradeCounts[subId] || 0;
      const nextMain = after[mainId] || 0;
      const nextSub = after[subId] || 0;
      const willEvolve = nextMain >= mainNeed && nextSub >= subNeed;
      const touches = upgradeId === mainId || upgradeId === subId;
      if (!touches) return;
      const beforeTotal = Math.min(nowMain, mainNeed) + Math.min(nowSub, subNeed);
      const afterTotal = Math.min(nextMain, mainNeed) + Math.min(nextSub, subNeed);
      const totalNeed = mainNeed + subNeed;
      const conditionLine = `${upgrades[mainId].name}Lv${mainNeed} + ${upgrades[subId].name}Lv${subNeed}`;
      const currentLine = `${upgrades[mainId].name}Lv${nextMain}/${mainNeed}・${upgrades[subId].name}Lv${nextSub}/${subNeed}`;
      list.push({
        evoId,
        name: evo.name,
        asset: evo.asset,
        willEvolve,
        beforeTotal,
        afterTotal,
        totalNeed,
        conditionLine,
        currentLine,
        line: currentLine
      });
    }

    entry("holyShot", "shotgun", 3, "range", 1);
    entry("pierceShotgun", "pierce", 3, "shotgun", 2);
    entry("whirlOrbit", "orbit", 3, "haste", 1);
    entry("sanctuary", "wall", 3, "slow", 1);
    return list.sort((a, b) => Number(b.willEvolve) - Number(a.willEvolve) || b.afterTotal - a.afterTotal);
  }

  function nearEvolutionCandidateIds(s) {
    const ids = new Set();
    const c = s.upgradeCounts || {};
    const addIfClose = (evoId, mainId, mainNeed, subId, subNeed) => {
      if (s.evolutions[evoId]) return;
      const main = c[mainId] || 0;
      const sub = c[subId] || 0;
      const progress = Math.min(main, mainNeed) + Math.min(sub, subNeed);
      const total = mainNeed + subNeed;
      if (progress >= total - 2) {
        if (main < mainNeed) ids.add(mainId);
        if (sub < subNeed) ids.add(subId);
      }
    };
    addIfClose("holyShot", "shotgun", 3, "range", 1);
    addIfClose("pierceShotgun", "pierce", 3, "shotgun", 2);
    addIfClose("whirlOrbit", "orbit", 3, "haste", 1);
    addIfClose("sanctuary", "wall", 3, "slow", 1);
    return Array.from(ids);
  }

  function chooseUpgradeCandidates(s) {
    const ids = new Set();
    for (const id of nearEvolutionCandidateIds(s)) ids.add(id);
    if (!s.oni && s.cryptid.hp < 55) ids.add("heal");
    if (s.enemies.length > 24) ids.add("orbit");
    if (s.enemies.length > 18) ids.add("shotgun");
    if (s.enemies.some(e => e.type === "archer")) ids.add("range");
    if (s.cryptid.hp < 35) ids.add("shield");
    if (s.oni) ids.delete("heal");
    const all = Object.keys(upgrades).filter(id => !(s.oni && id === "heal"));
    while (ids.size < 3) ids.add(all[Math.floor(Math.random() * all.length)]);
    return Array.from(ids).filter(id => !(s.oni && id === "heal")).slice(0, 3);
  }

  function buildUpgradeCard(id) {
    const u = upgrades[id];
    const current = state.upgradeCounts[id] || 0;
    const next = current + 1;
    const progress = evolutionProgressForUpgrade(state, id);
    const will = progress.find(p => p.willEvolve);
    const best = will || progress[0];
    const btn = document.createElement("button");
    btn.className = "upgrade-card" + (will ? " will-evolve" : best ? " has-evo-progress" : "");

    const img = u.asset ? `<img class="upgrade-img" src="${u.asset}" alt="${u.name}" onerror="this.style.display='none'" draggable="false">` : "";
    const level = `<span class="level-pill">Lv${current} → Lv${next}</span>`;
    let evoHtml = "";
    if (will) {
      evoHtml = `<div class="evo-box ready">${will.asset ? `<img src="${will.asset}" alt="${will.name}" onerror="this.style.display='none'" draggable="false">` : ""}<div><b>覚醒確定</b><span>${will.name}</span><small>条件: ${will.conditionLine}</small></div></div>`;
    } else if (best) {
      evoHtml = `<div class="evo-box"><div><b>${best.name}まで ${best.afterTotal}/${best.totalNeed}</b><span>条件: ${best.conditionLine}</span><small>現在: ${best.currentLine}</small></div></div>`;
    }
    btn.innerHTML = `${img}<div class="upgrade-title"><b>${u.name}</b>${level}</div><small class="upgrade-desc">${u.desc}</small>${evoHtml}`;
    btn.addEventListener("click", () => {
      u.apply(state);
      state.upgradeCounts[id] = (state.upgradeCounts[id] || 0) + 1;
      state.stats.upgrades++;
      checkEvolutions(state);
      state.ce -= state.ceNeed;
      state.ceNeed = Math.floor(state.ceNeed * 1.15 + 3);
      pausedForUpgrade = false;
      screens.upgrade.classList.remove("active");
      mode = "game";
      updateUI(state);
      last = performance.now();
      requestAnimationFrame(loop);
    });
    return btn;
  }

  function upgradeSummaryText(s) {
    const near = nearEvolutionCandidateIds(s);
    const readyNames = [];
    for (const id of Object.keys(upgrades)) {
      const will = evolutionProgressForUpgrade(s, id).find(p => p.willEvolve);
      if (will) readyNames.push(`${upgrades[id].name}で${will.name}`);
    }
    if (readyNames.length) return `覚醒間近: ${readyNames.slice(0, 2).join(" / ")}`;
    if (near.length) return `覚醒に近いエクステンションを候補に含めています。Lv表示と必要素材を見て選べます。`;
    return s.cryptid.hp < 45 ? "ヨシュカが危険です。守りを厚くする候補を含めています。" : "エクステンションを選ぶとLvが上がります。組み合わせ条件を満たすと上位エクステが覚醒します。";
  }

  function openUpgrade() {
    pausedForUpgrade = true;
    const candidates = chooseUpgradeCandidates(state);
    ui.upgradeOptions.innerHTML = "";
    ui.upgradeHint.textContent = upgradeSummaryText(state);
    for (const id of candidates) ui.upgradeOptions.appendChild(buildUpgradeCard(id));
    setScreen("upgrade");
  }

  function updateUI(s) {
    if (s.oni) {
      const ot = Math.floor(s.oniTime);
      ui.time.textContent = `鬼 ${String(Math.floor(ot / 60)).padStart(2, "0")}:${String(ot % 60).padStart(2, "0")}`;
      ui.time.classList.add("oni-hud");
    } else {
      const remain = Math.max(0, Math.ceil(s.duration - s.t));
      ui.time.textContent = `${String(Math.floor(remain / 60)).padStart(2, "0")}:${String(remain % 60).padStart(2, "0")}`;
      ui.time.classList.remove("oni-hud");
    }
    ui.hp.textContent = `${Math.ceil(s.cryptid.hp)}%`;
    ui.ce.textContent = `${Math.floor(s.ce)}/${s.ceNeed}`;
    ui.score.textContent = `${Math.floor(s.score)}`;
  }

  function endGame(win) {
    if (!state || state.ended) return;
    state.ended = true;
    state.stats.clearBonus = state.t >= state.duration ? 900 : 0;
    state.stats.hpBonus = Math.floor(Math.max(0, state.cryptid.hp) * 12);
    state.stats.killBonus = state.kills * 3;
    const finalScore = Math.floor(state.score + state.stats.clearBonus + state.stats.hpBonus + state.stats.killBonus);
    const saved = loadSave();
    saved.plays = (saved.plays || 0) + 1;
    saved.best = Math.max(saved.best || 0, finalScore);
    save(saved);
    ui.resultTitle.textContent = state.t >= state.duration ? "スコア確定" : "防衛失敗";
    ui.resultSummary.textContent = state.t >= state.duration ? "ヨシュカを3分守り切りました。鬼TIMEボーナス！" : "ヨシュカが倒されました。次は危険な敵を早めに処理してください。";
    const build = buildText(state);
    ui.resultStats.innerHTML = `
      <div><b>スコア</b>${finalScore}</div>
      <div><b>最高スコア</b>${saved.best}</div>
      <div><b>討伐数</b>${state.kills}</div>
      <div><b>回収CE</b>${state.stats.ceCollected}</div>
      <div><b>撃破点</b>${state.stats.enemyScore}</div>
      <div><b>CE点</b>${state.stats.ceScore}</div>
      <div><b>防衛点</b>${state.stats.clearBonus + state.stats.hpBonus}</div>
      <div><b>鬼TIME加点</b>${state.stats.oniBonus}</div>
      <div><b>到達時間</b>${Math.floor(state.t)}秒</div>
      <div><b>ビルド</b>${build}</div>
      <div class="wide"><b>共有用</b>Score ${finalScore} / ${build}</div>
    `;
    updateBestText();
    setScreen("result");
    triggerGoldChestEffect();
  }

  function triggerGoldChestEffect() {
    const panel = screens.result;
    if (!panel) return;
    panel.classList.remove("fallback-gold");
    window.setTimeout(() => {
      if (mode === "result") showGoldChest();
    }, 260);
  }

  function showGoldChest() {
    const panel = screens.result;
    if (panel) panel.classList.remove("fallback-gold");
    let modalShown = false;
    const modal = window.GoldChestModal;
    if (modal && typeof modal.show === "function") {
      try {
        modal.show();
        modalShown = true;
        bringConfettiToFront();
      } catch (err) {
        console.warn("GoldChestModal.show() failed. Using fallback effect.", err);
      }
    }
    // GoldChestModal.show() should include confetti according to the GoldChest quick start.
    // Some environments show the chest but fail to render the bundled confetti canvas,
    // so we also fire a small local confetti burst to guarantee feedback.
    launchLocalConfetti();
    if (!modalShown && panel) {
      panel.classList.add("fallback-gold");
      window.setTimeout(() => panel.classList.remove("fallback-gold"), 1300);
    }
  }

  function bringConfettiToFront() {
    const canvas = document.getElementById("confetti-canvas");
    if (canvas) {
      canvas.style.zIndex = "2147483647";
      canvas.style.pointerEvents = "none";
      canvas.style.position = "fixed";
    }
  }

  function launchLocalConfetti() {
    const canvas = document.createElement("canvas");
    canvas.className = "local-confetti";
    canvas.width = window.innerWidth * window.devicePixelRatio;
    canvas.height = window.innerHeight * window.devicePixelRatio;
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    document.body.appendChild(canvas);
    bringConfettiToFront();
    const dpr = window.devicePixelRatio || 1;
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    const colors = ["#1e90ff", "#6b8e23", "#ffd700", "#ff69b4", "#ff4500", "#00ced1", "#9370db", "#fff176"];
    const count = 120;
    const parts = Array.from({ length: count }, (_, i) => ({
      x: window.innerWidth * (0.12 + Math.random() * 0.76),
      y: -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 5.5,
      vy: 2.0 + Math.random() * 4.2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.28,
      w: 5 + Math.random() * 7,
      h: 10 + Math.random() * 10,
      color: colors[i % colors.length],
      life: 1
    }));
    let start = performance.now();
    function frame(now) {
      const t = (now - start) / 1000;
      c.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.035;
        p.rot += p.vr;
        p.life = Math.max(0, 1 - t / 2.1);
        c.save();
        c.globalAlpha = p.life;
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.fillStyle = p.color;
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
      }
      if (t < 2.2) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  function draw() {
    if (!state) return;
    const s = state;
    ctx.clearRect(0, 0, W, H);
    if (!drawBackgroundImage(s)) {
      const g = ctx.createRadialGradient(W/2, H/2, 20, W/2, H/2, 520);
      g.addColorStop(0, s.oni ? "#3a1016" : "#1b2a43");
      g.addColorStop(1, "#090b12");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    drawGrid(s);
    drawCryptid(s);
    for (const gem of s.gems) drawGem(gem);
    for (const e of s.enemies) drawEnemy(e);
    for (const b of s.bullets) drawBullet(b);
    drawPlayer(s);
    for (const w of s.warnings) drawWarning(w);
    for (const f of s.floaters) drawFloater(f);
    if (s.evolutionBanner) drawEvolutionBanner(s.evolutionBanner);
    if (s.oni) drawOniText(s);
    if (s.paused) drawCenterText("PAUSE");
  }


  function drawBackgroundImage(s) {
    const img = loadImage(assetPaths.background);
    if (!img || !img._ready) return false;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    ctx.fillStyle = s.oni ? "rgba(75, 0, 0, 0.45)" : "rgba(3, 8, 18, 0.48)";
    ctx.fillRect(0, 0, W, H);
    return true;
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

    // Draw field effects first. If globalAlpha is not reset here,
    // the orbiting extension becomes faint and looks hidden under the aura.
    ctx.shadowBlur = 0;
    if (c.slow > 0) {
      ctx.globalAlpha = 0.12;
      circle(c.x, c.y, 120, "#83d6ff");
      ctx.globalAlpha = 1;
    }
    if (s.evolutions.sanctuary) {
      ctx.globalAlpha = 0.10;
      circle(c.x, c.y, 124, "#b8f7ff");
      ctx.globalAlpha = 1;
    }

    // Orbiting extensions sit above the slow/sanctuary aura.
    const wallCount = effectiveWallCount(s);
    for (let i = 0; i < wallCount; i++) {
      const a = -s.t * (1.35 + i * 0.06) + (Math.PI * 2 * i) / Math.max(1, wallCount);
      const x = c.x + Math.cos(a) * 56;
      const y = c.y + Math.sin(a) * 56;
      ctx.save();
      ctx.shadowColor = s.evolutions.sanctuary ? "#b8f7ff" : "#83d6ff";
      ctx.shadowBlur = 12;
      circle(x, y, 8, s.evolutions.sanctuary ? "#b8f7ff" : "#83d6ff");
      ctx.restore();
    }

    // Yoshka is drawn last so the body stays crisp while the orbit remains visible outside it.
    ctx.shadowColor = c.hitFlash > 0 ? "#ff7979" : (s.oni ? "#ff4b4b" : "#83d6ff");
    ctx.shadowBlur = 24;
    const ok = drawAsset(s.oni ? assetPaths.yoshkaOni : assetPaths.yoshka, c.x, c.y, 78, 78);
    if (!ok) {
      circle(c.x, c.y, c.r, c.hitFlash > 0 ? "#ff7979" : (s.oni ? "#5a1820" : "#235b78"));
      ctx.shadowBlur = 0;
      ctx.strokeStyle = s.oni ? "#ff4b4b" : "#83d6ff"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.font = "24px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(s.oni ? "鬼" : "◇", c.x, c.y + 1);
    }
    ctx.restore();
  }
  function drawPlayer(s) {
    const p = s.player;
    ctx.save();
    circle(p.x, p.y, p.r + 5, "rgba(255,255,255,0.08)");
    if (!drawAsset(p.asset, p.x, p.y, 46, 46)) {
      circle(p.x, p.y, p.r, p.color);
      ctx.fillStyle = "#06101a"; ctx.font = "20px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.icon, p.x, p.y + 1);
    }
    ctx.globalAlpha = 0.12; circle(p.x, p.y, p.range, p.color); ctx.globalAlpha = 1;
    const orbitCount = effectiveOrbitCount(s);
    for (let i = 0; i < orbitCount; i++) { const a = s.t*((s.evolutions.whirlOrbit ? 2.75 : 1.85)+i*0.12)+(Math.PI*2*i)/Math.max(1,orbitCount); circle(p.x+Math.cos(a)*42, p.y+Math.sin(a)*42, 7, s.evolutions.whirlOrbit ? "#ffe8a3" : "#ffd166"); }
    ctx.restore();
  }
  function drawEnemy(e) {
    ctx.save();
    const path = e.oni ? assetPaths.oniEnemies[e.type] : assetPaths.enemies[e.type];
    if (!drawAsset(path, e.x, e.y, e.r * 3.0, e.r * 3.0)) {
      circle(e.x, e.y, e.r, e.color);
      ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = 1.5; ctx.stroke();
    }
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
  function drawEvolutionBanner(b) {
    ctx.save();
    const alpha = clamp(b.life, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(0,0,0,0.52)";
    ctx.strokeStyle = b.oni ? "#ff4b4b" : "#ffd166";
    ctx.lineWidth = 2;
    const x = W / 2 - 220, y = 58, w = 440, h = 48;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = b.oni ? "#ff4b4b" : "#ffd166"; ctx.font = "bold 22px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(b.text, W / 2, y + h / 2);
    ctx.restore();
  }

  function drawOniText(s) {
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(s.t * 6);
    ctx.fillStyle = "#ff4b4b";
    ctx.font = "900 58px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("鬼TIME", W / 2, 72);
    ctx.restore();
  }

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
  if (ui.goldChestBtn) ui.goldChestBtn.addEventListener("click", showGoldChest);

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
