/* Stag Hunt Arena, browser edition.
   A tiny split-screen raycaster: you are P1, a scripted bot is P2.
   Hares (+1) can be hunted alone. The stag (+5) is shielded unless both hunters stand within RANGE. */
(function () {
  "use strict";
  const cv = document.getElementById("game");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const arcade = document.getElementById("arcade");
  const VW = 320, VH = 200;          // one viewport
  const K = 3;                       // backing-store scale
  const RANGE = 3.2;                 // tiles: stag vulnerable when partners are this close
  const ROUND = 60;                  // seconds
  const FOV = 1.05;

  const MAP = [
    "1111111111111111",
    "1..............1",
    "1..2........2..1",
    "1..............1",
    "1.....1..1.....1",
    "1..............1",
    "1..2...22...2..1",
    "1......22......1",
    "1..............1",
    "1.....1..1.....1",
    "1..2........2..1",
    "1..............1",
    "1..............1",
    "1111111111111111",
  ];
  const MH = MAP.length, MW = MAP[0].length;
  const wall = (x, y) => { const r = MAP[y | 0]; if (!r) return "1"; const c = r[x | 0]; return c === "." || c === undefined ? null : c; };

  const load = src => { const i = new Image(); i.src = src; return i; };
  const IMG = {
    w1: load("assets/tex/stonew1.png"), w2: load("assets/tex/stonew5.png"),
    stag: load("assets/sprites/bossa1.png"), stagHit: load("assets/sprites/bossb1.png"),
    hare: load("assets/sprites/skula1.png"), hare2: load("assets/sprites/skulb1.png"),
    mate: load("assets/sprites/playa1.png"), puff: load("assets/sprites/tfoga0.png"),
  };

  let state, keys = {}, running = false, partnerMode = "loyal", camOn = true, last = 0, attractT = 0;

  function reset() {
    state = {
      t: ROUND, score: 0, stags: 0, hares: 0, msg: "", msgT: 0,
      p1: { x: 6.2, y: 12.2, a: -1.25, cd: 0, flash: 0 },
      p2: { x: 8.6, y: 11.6, a: -1.9, cd: 0, flash: 0, wander: 0 },
      stag: { x: 8, y: 3.2, a: 0, hp: 6, dead: 0, hit: 0 },
      hareList: [spawnHare(), spawnHare(), spawnHare(), spawnHare()],
      puffs: [],
      over: false,
    };
  }
  function freeSpot() {
    for (;;) { const x = 1.5 + Math.random() * (MW - 3), y = 1.5 + Math.random() * (MH - 3); if (!wall(x, y) && !wall(x + .3, y) && !wall(x - .3, y) && !wall(x, y + .3) && !wall(x, y - .3)) return { x, y }; }
  }
  function spawnHare() { const p = freeSpot(); return { x: p.x, y: p.y, a: Math.random() * 6.28, dead: 0, bob: Math.random() * 6 }; }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const close = () => dist(state.p1, state.p2) < RANGE;

  function move(o, dx, dy) {
    const r = 0.22;
    if (!wall(o.x + dx + Math.sign(dx) * r, o.y)) o.x += dx;
    if (!wall(o.x, o.y + dy + Math.sign(dy) * r)) o.y += dy;
  }
  function los(a, b) {
    const d = dist(a, b), n = Math.ceil(d * 8);
    for (let i = 1; i < n; i++) { const t = i / n; if (wall(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; }
    return true;
  }
  const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const angDiff = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  function shoot(who) {
    if (who.cd > 0) return;
    who.cd = 0.38; who.flash = 0.08;
    const targets = [];
    const S = state.stag;
    if (!S.dead) targets.push({ o: S, k: "stag" });
    state.hareList.forEach(h => { if (!h.dead) targets.push({ o: h, k: "hare" }); });
    let best = null, bd = 1e9;
    for (const t of targets) {
      const d = dist(who, t.o);
      const tol = Math.atan2(t.k === "stag" ? 0.45 : 0.3, d);
      if (Math.abs(angDiff(who.a, angTo(who, t.o))) < tol && d < bd && los(who, t.o)) { best = t; bd = d; }
    }
    if (!best) return;
    if (best.k === "hare") {
      best.o.dead = 2.2; state.score += 1; state.hares += 1;
      state.puffs.push({ x: best.o.x, y: best.o.y, t: 0.5 });
      if (who === state.p1) say("+1 HARE");
    } else {
      if (!close()) { say("SHIELDED · GET CLOSER TO P2"); return; }
      S.hp -= 1; S.hit = 0.15;
      if (S.hp <= 0) { S.dead = 3; state.score += 5; state.stags += 1; state.puffs.push({ x: S.x, y: S.y, t: 0.7 }); say("+5 STAG · TEAMWORK"); }
    }
  }
  function say(m) { state.msg = m; state.msgT = 1.6; }

  function bot(dt) {
    const b = state.p2, p = state.p1, S = state.stag;
    let goal = null, face = null;
    if (partnerMode === "loyal") {
      const dp = dist(b, p);
      if (!S.dead && dist(p, S) < 6) { goal = dp > RANGE * 0.6 ? p : S; face = S; }
      else if (dp > 2.2) { goal = p; face = p; }
      else { face = !S.dead ? S : p; }
    } else {
      let h = null, hd = 1e9;
      state.hareList.forEach(x => { if (!x.dead) { const d = dist(b, x); if (d < hd) { hd = d; h = x; } } });
      if (h) { goal = hd > 1.6 ? h : null; face = h; }
    }
    if (face) b.a += Math.max(-3 * dt, Math.min(3 * dt, angDiff(b.a, angTo(b, face))));
    if (goal && dist(b, goal) > 1.1) {
      const a = angTo(b, goal) + Math.sin(performance.now() / 700 + 1) * 0.35;
      move(b, Math.cos(a) * 1.9 * dt, Math.sin(a) * 1.9 * dt);
    }
    if (face && face !== p && Math.abs(angDiff(b.a, angTo(b, face))) < 0.08 && los(b, face)) {
      if (face === S && !close()) return;
      if (Math.random() < dt * 2.2) shoot(b);
    }
  }

  function update(dt) {
    const s = state;
    if (s.over) return;
    s.t -= dt;
    if (s.t <= 0) { s.t = 0; s.over = true; running = false; return; }
    const p = s.p1, sp = 2.6 * dt, tr = 2.4 * dt;
    if (keys.left) p.a -= tr;
    if (keys.right) p.a += tr;
    const fx = Math.cos(p.a), fy = Math.sin(p.a);
    if (keys.up) move(p, fx * sp, fy * sp);
    if (keys.down) move(p, -fx * sp * .7, -fy * sp * .7);
    if (keys.sl) move(p, fy * sp * .8, -fx * sp * .8);
    if (keys.sr) move(p, -fy * sp * .8, fx * sp * .8);
    if (keys.fire) shoot(p);
    [s.p1, s.p2].forEach(o => { o.cd = Math.max(0, o.cd - dt); o.flash = Math.max(0, o.flash - dt); });
    bot(dt);
    const S = s.stag;
    if (S.dead) { S.dead -= dt; if (S.dead <= 0) { S.dead = 0; S.hp = 6; const q = freeSpot(); S.x = q.x; S.y = q.y; } }
    else {
      S.a += (Math.random() - .5) * dt * 2;
      const ox = S.x, oy = S.y; move(S, Math.cos(S.a) * .55 * dt, Math.sin(S.a) * .55 * dt);
      if (S.x === ox && S.y === oy) S.a += 1.6;
    }
    S.hit = Math.max(0, S.hit - dt);
    s.hareList.forEach((h, i) => {
      if (h.dead) { h.dead -= dt; if (h.dead <= 0) s.hareList[i] = spawnHare(); return; }
      h.bob += dt * 4;
      h.a += (Math.random() - .5) * dt * 4;
      const ox = h.x, oy = h.y; move(h, Math.cos(h.a) * 1.1 * dt, Math.sin(h.a) * 1.1 * dt);
      if (h.x === ox && h.y === oy) h.a += 2;
    });
    s.puffs = s.puffs.filter(f => (f.t -= dt) > 0);
    s.msgT = Math.max(0, s.msgT - dt);
  }

  /* ───────── rendering ───────── */
  const zbuf = new Float32Array(VW);
  function view(cam, ox, tint, label, other) {
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, 0, VW, VH); ctx.clip();
    // ceiling + floor
    let g = ctx.createLinearGradient(0, 0, 0, VH / 2);
    g.addColorStop(0, "#14130c"); g.addColorStop(1, "#2a2818");
    ctx.fillStyle = g; ctx.fillRect(ox, 0, VW, VH / 2);
    g = ctx.createLinearGradient(0, VH / 2, 0, VH);
    g.addColorStop(0, "#2b2a22"); g.addColorStop(1, "#5b574a");
    ctx.fillStyle = g; ctx.fillRect(ox, VH / 2, VW, VH / 2);
    // walls (DDA)
    for (let x = 0; x < VW; x++) {
      const ra = cam.a + (x / VW - 0.5) * FOV;
      const dx = Math.cos(ra), dy = Math.sin(ra);
      let mx = cam.x | 0, my = cam.y | 0;
      const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
      let stx, sty, sdx, sdy, side = 0, hit = null;
      if (dx < 0) { stx = -1; sdx = (cam.x - mx) * ddx; } else { stx = 1; sdx = (mx + 1 - cam.x) * ddx; }
      if (dy < 0) { sty = -1; sdy = (cam.y - my) * ddy; } else { sty = 1; sdy = (my + 1 - cam.y) * ddy; }
      for (let i = 0; i < 64 && !hit; i++) {
        if (sdx < sdy) { sdx += ddx; mx += stx; side = 0; } else { sdy += ddy; my += sty; side = 1; }
        hit = wall(mx, my);
      }
      let d = side === 0 ? sdx - ddx : sdy - ddy;
      d *= Math.cos(ra - cam.a);
      d = Math.max(d, 0.05);
      zbuf[x] = d;
      const h = VH / d * 1.05;
      const top = VH / 2 - h / 2;
      let wx = side === 0 ? cam.y + (sdx - ddx) * dy : cam.x + (sdy - ddy) * dx;
      wx -= Math.floor(wx);
      const tex = hit === "2" ? IMG.w2 : IMG.w1;
      if (tex.complete && tex.naturalWidth) {
        const tx = Math.min(tex.naturalWidth - 1, (wx * tex.naturalWidth) | 0);
        ctx.drawImage(tex, tx, 0, 1, tex.naturalHeight, ox + x, top, 1, h);
      } else { ctx.fillStyle = "#5a5648"; ctx.fillRect(ox + x, top, 1, h); }
      const shade = Math.min(0.82, d / 11 + (side ? 0.18 : 0));
      ctx.fillStyle = `rgba(12,10,4,${shade})`; ctx.fillRect(ox + x, top, 1, h);
    }
    // sprites
    const S = state.stag, list = [];
    if (!S.dead) list.push({ o: S, img: S.hit > 0 ? IMG.stagHit : IMG.stag, h: 1.25, shield: !close() });
    state.hareList.forEach(h => { if (!h.dead) list.push({ o: h, img: Math.sin(h.bob) > 0 ? IMG.hare : IMG.hare2, h: 0.55, lift: 0.18 + Math.sin(h.bob) * 0.04 }); });
    list.push({ o: other, img: IMG.mate, h: 0.95, mate: true });
    state.puffs.forEach(f => list.push({ o: f, img: IMG.puff, h: 0.9 }));
    list.forEach(s => (s.d = dist(cam, s.o)));
    list.sort((a, b) => b.d - a.d);
    for (const s of list) {
      const ang = angDiff(cam.a, angTo(cam, s.o));
      if (Math.abs(ang) > FOV * 0.75 || s.d < 0.25) continue;
      const pd = s.d * Math.cos(ang);
      const sx = (0.5 + ang / FOV) * VW;
      const im = s.img;
      if (!im.complete || !im.naturalWidth) continue;
      const sh = VH / pd * s.h, sw = sh * im.naturalWidth / im.naturalHeight;
      const floorY = VH / 2 + (VH / pd * 1.05) / 2;
      const sy = floorY - sh - (s.lift ? VH / pd * s.lift : 0);
      const x0 = Math.floor(sx - sw / 2), x1 = Math.ceil(sx + sw / 2);
      let visible = false;
      for (let x = Math.max(0, x0); x < Math.min(VW, x1); x++) {
        if (zbuf[x] < pd) continue;
        visible = true;
        const u = (x - (sx - sw / 2)) / sw;
        ctx.drawImage(im, Math.min(im.naturalWidth - 1, (u * im.naturalWidth) | 0), 0, 1, im.naturalHeight, ox + x, sy, 1, sh);
      }
      if (!visible) continue;
      const fog = Math.min(0.7, pd / 13);
      if (fog > 0.05) { ctx.fillStyle = `rgba(12,10,4,${fog * .6})`; }
      if (s.shield) {
        ctx.strokeStyle = "rgba(167,162,242,.95)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(ox + sx, sy + sh * 0.5, sw * 0.62, sh * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(125,118,232,.18)"; ctx.fill();
      }
      if (s.mate && pd < 14) {
        ctx.font = "14px VT323, monospace"; ctx.textAlign = "center";
        ctx.fillStyle = tint === "#f2801a" ? "#6b74ff" : "#f2801a";
        ctx.fillText(tint === "#f2801a" ? "P2" : "P1", ox + sx, sy - 4);
      }
    }
    // crosshair + muzzle flash
    if (cam.flash > 0) { ctx.fillStyle = "rgba(255,210,90,.18)"; ctx.fillRect(ox, 0, VW, VH); }
    ctx.fillStyle = tint;
    ctx.fillRect(ox + VW / 2 - 5, VH / 2, 3, 1); ctx.fillRect(ox + VW / 2 + 3, VH / 2, 3, 1);
    ctx.fillRect(ox + VW / 2, VH / 2 - 5, 1, 3); ctx.fillRect(ox + VW / 2, VH / 2 + 3, 1, 3);
    // HUD strip
    ctx.fillStyle = "rgba(0,0,0,.66)"; ctx.fillRect(ox, VH - 20, VW, 20);
    ctx.font = "16px VT323, monospace"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillStyle = tint; ctx.fillText(label, ox + 6, VH - 10);
    const near = close();
    ctx.fillStyle = near ? "#eee164" : "#a39f78";
    ctx.textAlign = "center";
    ctx.fillText(near ? "STAG VULNERABLE" : `PARTNER ${dist(state.p1, state.p2).toFixed(1)}m · STAG SHIELDED`, ox + VW / 2, VH - 10);
    ctx.textAlign = "right"; ctx.fillStyle = "#ece4e2";
    ctx.fillText(`${Math.ceil(state.t)}s`, ox + VW - 6, VH - 10);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (running) update(dt);
    else if (!state.started) {   // attract mode: slow pan, bot strolls
      attractT += dt;
      state.p1.a = -1.25 + Math.sin(attractT * 0.25) * 0.45;
      state.p2.a = Math.atan2(state.stag.y - state.p2.y, state.stag.x - state.p2.x) + Math.sin(attractT * 0.3) * 0.3;   // bot keeps the stag in view
    }
    draw();
    requestAnimationFrame(frame);
  }
  function draw() {
    const W = camOn ? VW * 2 : VW;
    if (cv.width !== W * K) { cv.width = W * K; cv.height = VH * K; }
    ctx.setTransform(K, 0, 0, K, 0, 0);   // draw at 320x200 logic, store at 3x so the pixels stay square anywhere
    ctx.imageSmoothingEnabled = false;
    view(state.p1, 0, "#f2801a", "P1 · YOU", state.p2);
    if (camOn) view(state.p2, VW, "#6b74ff", "P2 · BOT", state.p1);
    // overlays
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (!running) {
      ctx.fillStyle = "rgba(10,9,5,.62)"; ctx.fillRect(0, 0, W, VH - 20);
      ctx.fillStyle = "#eee164"; ctx.font = "28px VT323, monospace";
      if (state.over) {
        ctx.fillText(`TEAM SCORE ${state.score}`, W / 2, 62);
        ctx.font = "17px VT323, monospace"; ctx.fillStyle = "#ece4e2";
        ctx.fillText(`${state.stags} stag${state.stags === 1 ? "" : "s"} · ${state.hares} hare${state.hares === 1 ? "" : "s"}`, W / 2, 90);
        ctx.fillStyle = "#a39f78";
        ctx.fillText(state.stags ? "You found the cooperative equilibrium." : "All hares, no stag: the safe equilibrium.", W / 2, 112);
        ctx.fillStyle = "#eee164"; ctx.fillText("CLICK OR PRESS R TO PLAY AGAIN", W / 2, 142);
      } else {
        ctx.fillText(state.started ? "PAUSED · CLICK TO RESUME" : "CLICK TO PLAY", W / 2, 74);
        ctx.font = "17px VT323, monospace"; ctx.fillStyle = "#ece4e2";
        ctx.fillText("60 seconds · hares +1 · stag +5 when together", W / 2, 102);
        ctx.fillStyle = "#a39f78";
        ctx.fillText("WASD / arrows to move · Space to shoot", W / 2, 122);
      }
    } else {
      ctx.font = "20px VT323, monospace"; ctx.fillStyle = "#eee164";
      ctx.textAlign = "left"; ctx.fillText(`TEAM ${state.score}`, 8, 14);
      if (state.msgT > 0) { ctx.textAlign = "center"; ctx.fillStyle = `rgba(238,225,100,${Math.min(1, state.msgT)})`; ctx.fillText(state.msg, VW / 2, 40); }
    }
  }

  function start() {
    if (!running) { if (state.over || !state.started) { reset(); state.started = true; } running = true; }
    cv.focus({ preventScroll: true });
  }
  cv.addEventListener("click", start);
  const KM = { ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ArrowLeft: "left", ArrowRight: "right", KeyA: "sl", KeyD: "sr", KeyQ: "left", KeyE: "right", Space: "fire", ControlLeft: "fire" };
  cv.addEventListener("keydown", e => {
    if (e.code === "KeyR") { reset(); state.started = true; running = true; return; }
    const k = KM[e.code]; if (!k) return;
    e.preventDefault(); keys[k] = true;
    if (!running && !state.over) start();
  });
  cv.addEventListener("keyup", e => { const k = KM[e.code]; if (k) { e.preventDefault(); keys[k] = false; } });
  cv.addEventListener("blur", () => { keys = {}; });
  // touch controls
  document.querySelectorAll("#touchpad button").forEach(b => {
    const k = b.dataset.k === "left" ? "left" : b.dataset.k === "right" ? "right" : b.dataset.k;
    b.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; if (!running) start(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => b.addEventListener(ev, () => (keys[k] = false)));
  });
  document.querySelectorAll("[data-partner]").forEach(b => b.addEventListener("click", () => {
    partnerMode = b.dataset.partner;
    document.querySelectorAll("[data-partner]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  }));
  document.querySelectorAll("[data-cam]").forEach(b => b.addEventListener("click", () => {
    camOn = b.dataset.cam === "on";
    arcade.classList.toggle("solo", !camOn);
    document.querySelectorAll("[data-cam]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  }));
  // pause when scrolled away
  if ("IntersectionObserver" in window) new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting && running) { running = false; keys = {}; } })).observe(cv);

  reset();
  Object.values(IMG).forEach(i => i.addEventListener("load", () => { if (!running) draw(); }));
  if (document.fonts) document.fonts.ready.then(() => { if (!running) draw(); });
  draw();
  requestAnimationFrame(frame);
})();
