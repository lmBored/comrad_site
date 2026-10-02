/* COMRAD project page: data + small interactive pieces. No dependencies. */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };
  const SPR = "assets/sprites/";

  /* ───────── data: Table 2 of the paper (100M steps, N=2, held-out maps, 5 seeds) ───────── */
  const ALGOS = ["IPPO", "MAPPO", "HAPPO", "IDQN", "VDN", "QMIX", "QPLEX-D", "QPLEX-Q"];
  const ON = 3; // first three are on-policy
  const TIERS = { 1: "Easy", 2: "Medium", 3: "Difficult", 4: "Very difficult" };
  const SCEN = [
    { name: "Stag Hunt Arena", d: 1, g: 1, n: "2–4", obs: "Vision", a: 54, obj: "stag kills", ceil: 36, img: 1, v: ["1a", "1b"],
      chal: "Hunt small hares alone, or stay close enough to a teammate to bring down the shielded stag. The hare-versus-stag dilemma, under partial observability.",
      cap: "Left: the stag is shielded while players are apart. Right: a teammate and the stag in view.",
      m: [17.41, 25.48, 2.63, 14.19, 18.11, 0.26, 1.53, 3.35], ci: [0.24, 0.30, 0.11, 0.17, 0.36, 0.06, 0.09, 0.21] },
    { name: "Rhythm Sync", d: 3, g: 2, n: "2", obs: "Vis+Vec", a: 54, obj: "synchronized activations", ceil: 1, img: 2, v: ["2a", "2b"],
      chal: "Two separated agents must hit their switches inside the same timing window, with no way to talk.",
      cap: "Left: torch, door, partner and the timing cue. Right: one agent waits for the other to reach the torch.",
      m: [0.57, 0.67, 0.21, 0, 0, 0, 0, 0], ci: [0.05, 0.04, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01] },
    { name: "Foraging Commons", d: 3, g: 2, n: "2–4", obs: "Vis+Vec", a: 27, obj: "survival time", ceil: 21000, img: 3, v: ["reward_1"],
      chal: "Harvest health pots to survive, or stand in the cleanup station to keep the shared spawn rate up. Over-harvest and the commons collapses.",
      cap: "Shared spawn-rate bar, a teammate restoring the commons, a harvestable pot, and your own decaying health.",
      m: [2341.18, 2497.55, 2212.40, 2178.36, 2339.82, 2531.07, 1918.44, 2358.61], ci: [29.74, 32.06, 38.15, 33.41, 41.27, 45.32, 24.10, 38.05] },
    { name: "Co-op Puzzle", d: 3, g: 2, n: "2", obs: "Vision", a: 18, obj: "completed puzzle pairs", ceil: 5, img: 4, v: ["4a", "4b"],
      chal: "Gates open in strict turns: one agent holds a pressure plate so the other can pass, then they swap.",
      cap: "Left: holding the plate opens the right-hand door. Right: the roles swap.",
      m: [2.98, 3.82, 2.15, 0.02, 0.06, 0, 0, 0.05], ci: [0.08, 0.11, 0.16, 0.01, 0.02, 0.01, 0.01, 0.03] },
    { name: "Platform Chain", d: 4, g: 2, n: "2", obs: "Vision", a: 54, obj: "joint checkpoint progress", ceil: 47, img: 5, v: ["5a", "5b"],
      chal: "A physical tether binds the pair. Jump platform to platform together or drag each other into the void.",
      cap: "Left: a joint jump to the next platform. Right: the chain turns red while one agent is dragged.",
      m: [1.96, 4.85, 4.59, 0.71, 1.09, 0.94, 3.33, 1.01], ci: [0.02, 0.18, 0.19, 0.06, 0.07, 0.03, 0.21, 0.03] },
    { name: "Armory Siege", d: 4, g: 2, n: "2–8", obs: "Vis+Vec", a: 162, obj: "survival and kills", ceil: 100, img: 6, v: ["6a", "6b"],
      chal: "Defend the central core while rotating team members out to collect resources from distant supply rooms.",
      cap: "Left: enemies attacking the core. Right: an agent takes one down.",
      m: [15.95, 19.20, -0.85, 10.50, 17.80, 20.45, 1.05, 13.60], ci: [3.10, 2.45, 1.15, 1.05, 1.55, 4.05, 0.95, 2.65] },
    { name: "Co-op Health Gathering", d: 4, g: 2, n: "2", obs: "Vision", a: 27, obj: "survival time", ceil: 2100, img: 7, v: ["7a", "7b"],
      chal: "Tethered together on a floor that drains health, the pair has to agree on where the medkits are.",
      cap: "Left: the tether turns red as one agent is dragged. Right: both gather health together.",
      m: [1092.44, 561.20, 201.36, 161.87, 566.41, 168.95, 190.42, 273.05], ci: [121.65, 28.44, 8.24, 2.20, 26.83, 2.13, 5.31, 17.82] },
    { name: "Lava Pit", d: 5, g: 3, n: "2", obs: "Vision", a: 36, obj: "joint traversal", ceil: 11, img: 8, v: ["8a", "8b"],
      chal: "Bridges over lava only stay up while a partner holds the plate. Agents take turns carrying each other across.",
      cap: "Left: one agent holds the plate so the bridge stays on. Right: nobody on the plate, no bridge.",
      m: [0.90, 1.00, 1.00, 0.93, 0.78, 0.96, 0, 1.00], ci: [0.01, 0.01, 0.01, 0.01, 0.05, 0.03, 0.01, 0.01] },
    { name: "Smart Enemies", d: 5, g: 3, n: "2–4", obs: "Vision", a: 54, obj: "enemy kills", ceil: 84, img: 9, v: ["9a", "9b"],
      chal: "Enemies speed up under concentrated fire, so the team has to spread out and keep pressure from several angles.",
      cap: "Left: an agent shoots an enemy. Right: agents stay together to hunt.",
      m: [11.39, 14.47, 6.71, 3.38, 4.77, 0.61, 0, 0.68], ci: [0.84, 0.62, 0.40, 0.22, 0.36, 0.08, 0.01, 0.07] },
    { name: "Dumb Enemies", d: 5, g: 3, n: "2–4", obs: "Vision", a: 54, obj: "enemy kills", ceil: 90, img: 9, v: ["10"],
      chal: "Enemies flee from a lone agent but slow down near a group. Only cooperative pursuit catches them.",
      cap: "An agent about to shoot without its partner nearby.",
      m: [12.21, 2.35, 0.99, 1.11, 2.68, 1.14, 0, 1.86], ci: [1.87, 0.21, 0.12, 0.12, 0.23, 0.14, 0.01, 0.17] },
    { name: "Ammo Carrier", d: 6, g: 3, n: "2", obs: "Vis+Vec", a: 36, obj: "survival time", ceil: 8400, img: 11, v: ["11a", "11b"],
      chal: "A stationary defender holds the hub; a mobile carrier must keep running ammo from the depots so the shooting never stops.",
      cap: "Left: the defender fires while the runner collects ammo. Right: the shooter lines up a target.",
      m: [7031.42, 1351.10, 1310.45, 3795.80, 2511.20, 2341.15, 1515.60, 2045.30], ci: [495.12, 74.30, 62.15, 390.11, 225.40, 145.20, 61.22, 201.10] },
    { name: "Stealth Labyrinth", d: 7, g: 4, n: "2", obs: "Vision", a: 54, obj: "relays activated", ceil: 1, img: 10, v: ["12"],
      chal: "A torch-bearer lights dark rooms one at a time while a gunner clears them. Extreme asymmetric observability.",
      cap: "The hallway is dark; the gunner waits for the torch-bearer to go first.",
      m: [0, 0, 0, 0, 0, 0.21, 0, 0], ci: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01] },
    { name: "Lava Maze", d: 7, g: 4, n: "2", obs: "Vis+Vec", a: 90, obj: "mazes completed", ceil: null, normCeil: 4, img: 12, v: ["13a", "13b"],
      chal: "A navigator crosses a lava maze it cannot see from above; a remote observer who can see it all has to invent a signal.",
      cap: "Left: the navigator at the start, the observer overhead. Right: the observer fires a colour to signal 'go right'.",
      m: [0, 0, 0, 0, 0, 0, 0, 0], ci: [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01] },
  ];
  const ceilOf = s => s.ceil || s.normCeil;
  const norm = (s, v) => Math.max(0, Math.min(1, v / ceilOf(s)));
  const fmt = v => {
    const a = Math.abs(v);
    if (a >= 1000) return v.toFixed(0);
    if (a >= 100) return v.toFixed(1);
    return v.toFixed(2);
  };
  const bestIdx = s => { const mx = Math.max(...s.m); return mx <= 0.005 ? [] : s.m.map((v, i) => (Math.abs(v - mx) < 1e-9 ? i : -1)).filter(i => i >= 0); };

  /* ───────── hero face follows the pointer ───────── */
  const face = $("#face");
  if (face) {
    let last = "";
    const set = f => { if (f !== last) { face.src = SPR + f + ".png"; last = f; } };
    window.addEventListener("pointermove", e => {
      const r = face.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      set(dx < -120 ? "stfst02" : dx > 120 ? "stfst00" : "stfst01");
    }, { passive: true });
    $$(".cta .btn").forEach(b => { b.addEventListener("pointerenter", () => set("stfevl0")); });
  }

  /* ───────── comparison table ───────── */
  const CMP = [
    ["SMAC / SMACv2", [0, 0, 1, 2, 1, 1], "2–27"],
    ["Google Research Football", [0, 2, 1, 0, 0, 1], "2–11"],
    ["Overcooked AI", [0, 0, 1, 0, 0, 1], "2"],
    ["Melting Pot 2.0", [0, 1, 2, 0, 0, 1], "2–16"],
    ["JaxMARL", [0, 0, 1, 0, 1, 1], "2–10"],
    ["MEAL", [0, 1, 1, 0, 1, 1], "2–4"],
    ["XLand", [1, 1, 2, 1, 0, 0], "2–16", true],
    ["Watch&Help", [1, 1, 1, 0, 0, 1], "2"],
    ["Habitat 3.0", [1, 1, 1, 0, 0, 1], "2"],
    ["TeamCraft", [1, 1, 1, 1, 0, 1], "2"],
    ["VIKI-Bench", [1, 1, 1, 0, 0, 1], "≥2"],
    ["COMRAD (ours)", [1, 1, 1, 1, 1, 1], "2–8", false, true],
  ];
  const cb = $("#cmp-body");
  if (cb) {
    const ic = { 1: '<i class="ck" aria-label="yes"></i>', 0: '<i class="xx" aria-label="no"></i>', 2: '<i class="pt" aria-label="partial"></i>' };
    CMP.forEach(([n, v, a, sep, ours]) => {
      const tr = el("tr", ours ? { class: "ours" } : {});
      tr.innerHTML = `<td${sep ? ' class="sep"' : ""}>${n}</td>` + v.map(x => `<td${sep ? ' class="sep"' : ""}>${ic[x]}</td>`).join("") + `<td${sep ? ' class="sep"' : ""}>${a}</td>`;
      cb.appendChild(tr);
    });
  }

  /* ───────── level select ───────── */
  const list = $("#lvl-list");
  if (list) {
    let cur = 0;
    let lastG = 0;
    SCEN.forEach((s, i) => {
      if (s.g !== lastG) {
        lastG = s.g;
        list.appendChild(el("div", { class: "tier-h" }, `<span class="skulls">${skulls(s.g)}</span>${TIERS[s.g]}`));
      }
      const b = el("button", { class: "lvl", role: "option", type: "button", "aria-selected": i === 0 ? "true" : "false", "data-i": i },
        `<img src="assets/scen/${s.img}.jpg" alt="" loading="lazy"><span><span class="nm">${s.name}</span><span class="mt" style="display:block">N ${s.n} · ${s.obs} · |A| ${s.a}</span></span>`);
      b.addEventListener("click", () => show(i));
      list.appendChild(b);
    });
    list.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); show(Math.min(SCEN.length - 1, cur + 1), true); }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, cur - 1), true); }
    });
    function show(i, focus) {
      cur = i;
      const s = SCEN[i];
      $$(".lvl", list).forEach((b, j) => b.setAttribute("aria-selected", j === i ? "true" : "false"));
      if (focus) $$(".lvl", list)[i].focus();
      // one plain first-person view per scenario (no annotated pair)
      $("#lvl-views").classList.add("single");
      $("#lvl-va").src = `assets/scen/${s.img}.jpg`;
      $("#lvl-va").alt = `${s.name}, first-person view`;
      $("#lvl-vb").hidden = true;
      $("#lvl-name").textContent = s.name;
      $("#lvl-skulls").innerHTML = skulls(s.g);
      $("#lvl-tier").textContent = `${TIERS[s.g]} · tier ${s.d} of 7`;
      $("#lvl-chal").textContent = s.chal;
      $("#lvl-n").textContent = s.n;
      $("#lvl-obs").textContent = s.obs;
      $("#lvl-a").textContent = s.a;
      $("#lvl-ceil").textContent = s.ceil ? fmt(s.ceil).replace(/\.00$/, "") : "none";
      $("#lvl-obj").textContent = s.obj;
      const best = bestIdx(s);
      const bars = $("#lvl-bars");
      bars.innerHTML = "";
      s.m.forEach((v, j) => {
        const w = (norm(s, v) * 100).toFixed(1);
        bars.appendChild(el("div", { class: `mb ${j < ON ? "on" : "off"}${best.includes(j) ? " best" : ""}` },
          `<span class="nm">${ALGOS[j]}</span><span class="track"><span class="fill" style="width:${w}%"></span></span><span class="val" title="± ${s.ci[j]}">${fmt(v)}</span>`));
      });
      $("#lvl-foot").innerHTML = best.length ? `<span><b class="yl">Best:</b> ${best.map(j => ALGOS[j]).join(", ")} at ${(norm(s, s.m[best[0]]) * 100).toFixed(0)}% of ceiling</span>` : `<span class="rd">No baseline scores above zero.</span>`;
    }
    show(0);
  }
  function skulls(n) { let h = ""; for (let i = 1; i <= 4; i++) h += `<i${i > n ? ' class="off"' : ""}></i>`; return h; }

  /* ───────── DoomGen re-roll ───────── */
  const vImg = $("#variant-img");
  if (vImg) {
    let vi = 0;
    const dots = $("#variant-dots");
    for (let i = 0; i < 6; i++) {
      const d = el("button", { type: "button", "aria-label": `Layout ${i + 1}`, "aria-current": i === 0 ? "true" : "false" });
      d.addEventListener("click", () => setV(i));
      dots.appendChild(d);
    }
    for (let i = 2; i <= 6; i++) { const p = new Image(); p.src = `assets/fig/doomgen_variant_${i}.jpg`; }
    function setV(i) {
      vi = i;
      vImg.src = `assets/fig/doomgen_variant_${i + 1}.jpg`;
      $("#variant-tag").textContent = `ARMORY SIEGE · LAYOUT ${i + 1} / 6`;
      $$("button", dots).forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
    }
    $("#reroll-btn").addEventListener("click", () => setV((vi + 1) % 6));
  }

  /* ───────── difficulty grid ───────── */
  const AX = { rows: ["Easy", "Medium", "Hard"], m: [[20.45, 17.98, 18.10], [22.88, 20.04, 21.12], [17.66, 15.68, 18.98]], ci: [[3.17, 1.85, 1.79], [2.88, 1.12, 2.14], [1.14, 0.62, 2.13]] };
  const grid = $("#axes-grid");
  if (grid) {
    const FIRE = [[0, [70, 18, 10]], [0.35, [168, 40, 20]], [0.6, [224, 92, 28]], [0.82, [244, 160, 40]], [1, [250, 226, 110]]];
    const fire = t => { for (let k = 1; k < FIRE.length; k++) { const [a, ca] = FIRE[k - 1], [b, cbb] = FIRE[k]; if (t <= b) { const u = (t - a) / (b - a); return ca.map((c, q) => Math.round(c + u * (cbb[q] - c))); } } return FIRE[FIRE.length - 1][1]; };
    grid.appendChild(el("div", { class: "h" }, "spatial ↓ / mech →"));
    ["Easy", "Medium", "Hard"].forEach(c => grid.appendChild(el("div", { class: "h" }, c)));
    AX.m.forEach((row, r) => {
      grid.appendChild(el("div", { class: "h row" }, AX.rows[r]));
      row.forEach((v, c) => {
        const t = (v - 15.2) / (23.2 - 15.2);
        const [R, G, B] = fire(t);
        const b = el("button", { class: "cell", type: "button", "aria-pressed": "false", style: `background:rgb(${R},${G},${B});color:${t > .45 ? "#140b04" : "#f3e7d6"}` },
          `<span class="s">${v.toFixed(2)}</span><span class="ci">± ${AX.ci[r][c]}</span>`);
        b.addEventListener("click", () => {
          $$(".cell", grid).forEach(x => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
          const d = r + c;
          let txt = `Spatial ${AX.rows[r]}, mechanical ${AX.rows[c]}: ${v.toFixed(2)} ± ${AX.ci[r][c]} (combined difficulty ${d} of 4).`;
          if (r === 2 && c === 1) txt += " The global minimum sits in the hardest spatial tier.";
          else if (r === 0 && c === 0) txt += " The joint-easy corner.";
          else if (r === 2) txt += " Hard layouts cost more than hard mechanics.";
          $("#axes-read").textContent = txt;
        });
        grid.appendChild(b);
      });
    });
  }

  /* ───────── scoreboard ───────── */
  const board = $("#board");
  if (board) {
    let unit = "raw", col = -1;
    const bf = $("#board-face"), say = $("#board-say");
    function render() {
      let h = `<thead><tr><th class="fam"></th><th class="fam on" colspan="3">ON-POLICY</th><th class="fam off" colspan="5">OFF-POLICY</th><th class="fam"></th></tr><tr><th>Scenario</th>`;
      ALGOS.forEach((a, j) => { h += `<th class="${j < ON ? "on" : "off"}${col === j ? " sel" : ""}" data-col="${j}" tabindex="0" scope="col">${a}</th>`; });
      h += `<th>Ceiling</th></tr></thead><tbody>`;
      SCEN.forEach((s, i) => {
        const best = bestIdx(s);
        h += `<tr data-row="${i}"><td class="sn">${s.name}</td>`;
        s.m.forEach((v, j) => {
          const nv = norm(s, v);
          const txt = unit === "raw" ? fmt(v) : nv.toFixed(2);
          const cls = [j < ON ? "onc" : "offc", best.includes(j) ? "best" : "", Math.abs(v) < 0.005 ? "zero" : "", col === j ? "colsel" : ""].join(" ");
          h += `<td class="${cls}" title="${ALGOS[j]}: ${fmt(v)} ± ${s.ci[j]}"><span class="c"><span class="bar" style="width:${(nv * 100).toFixed(1)}%"></span><span class="t">${txt}</span></span></td>`;
        });
        h += `<td class="ceil">${s.ceil ? (s.ceil >= 1000 ? s.ceil : s.ceil.toFixed(s.ceil < 2 ? 2 : 0)) : "–"}</td></tr>`;
      });
      board.innerHTML = h + "</tbody>";
      $$("th[data-col]", board).forEach(th => {
        const go = () => { col = col === +th.dataset.col ? -1 : +th.dataset.col; render(); describeCol(); };
        th.addEventListener("click", go);
        th.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      });
      $$("tbody tr", board).forEach(tr => tr.addEventListener("pointerenter", () => describeRow(+tr.dataset.row)));
    }
    function react(f, t) { bf.src = SPR + f + ".png"; say.textContent = t; }
    function describeRow(i) {
      const s = SCEN[i], best = bestIdx(s);
      if (!best.length) return react("stfdead0", `${s.name}: all eight baselines at zero.`);
      const nv = norm(s, s.m[best[0]]);
      const who = best.map(j => ALGOS[j]).join(" / ");
      if (nv >= 0.5) react("stfevl0", `${s.name}: ${who} reaches ${(nv * 100).toFixed(0)}% of the ceiling.`);
      else if (nv < 0.15) react("stfouch0", `${s.name}: best is ${who}, only ${(nv * 100).toFixed(0)}% of the ceiling.`);
      else react("stfst01", `${s.name}: ${who} leads at ${(nv * 100).toFixed(0)}% of the ceiling.`);
    }
    function describeCol() {
      if (col < 0) return react("stfst01", "Hover a row. Click a column header to follow one algorithm.");
      const wins = SCEN.filter(s => bestIdx(s).includes(col)).map(s => s.name);
      const mean = SCEN.reduce((a, s) => a + norm(s, s.m[col]), 0) / SCEN.length;
      react(wins.length >= 3 ? "stfgod0" : wins.length ? "stfst01" : "stfouch0",
        `${ALGOS[col]}: best on ${wins.length} scenario${wins.length === 1 ? "" : "s"}, mean ${mean.toFixed(2)} of ceiling.`);
    }
    $$("[data-unit]").forEach(b => b.addEventListener("click", () => {
      unit = b.dataset.unit;
      $$("[data-unit]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
      render();
    }));
    render();
  }

  /* ───────── tug of war: best on-policy vs best off-policy ───────── */
  const tug = $("#tug-rows");
  if (tug) {
    SCEN.forEach(s => {
      const on = s.m.slice(0, ON), off = s.m.slice(ON);
      const io = on.indexOf(Math.max(...on)), ifo = off.indexOf(Math.max(...off));
      const a = norm(s, on[io]), b = norm(s, off[ifo]);
      const win = a - b > 0.005 ? "win-l" : b - a > 0.005 ? "win-r" : "";
      const wa = (a * 85).toFixed(1) + "%", wb = (b * 85).toFixed(1) + "%"; // 15% headroom keeps the value label inside the column
      const r = el("div", { class: `tr ${win}` },
        `<div class="side l" style="--w:${wa}"><span class="b" style="width:${wa}"></span>${a > 0.12 ? `<span class="who">${ALGOS[io]}</span>` : ""}<span class="v">${a.toFixed(2)}</span></div>` +
        `<div class="lab">${s.name}</div>` +
        `<div class="side r" style="--w:${wb}"><span class="b" style="width:${wb}"></span>${b > 0.12 ? `<span class="who">${ALGOS[ON + ifo]}</span>` : ""}<span class="v">${b.toFixed(2)}</span></div>`);
      tug.appendChild(r);
    });
  }

  /* ───────── ammo carrier: images ↔ rollouts ───────── */
  const ap = $("#ammo-play");
  if (ap) {
    const figs = $$("#versus figure");
    const stills = figs.map(f => f.querySelector("img").outerHTML);
    const vids = ["ippo", "happo"].map(n => `<video src="assets/video/ammo_${n}.mp4" poster="assets/video/ammo_${n}.jpg" autoplay muted loop playsinline aria-label="${n.toUpperCase()} trajectory rollout"></video>`);
    ap.addEventListener("click", () => {
      const on = ap.getAttribute("aria-pressed") !== "true";
      ap.setAttribute("aria-pressed", on ? "true" : "false");
      ap.textContent = on ? "■ Show annotated maps" : "▶ Play the rollouts";
      figs.forEach((f, i) => { const m = f.querySelector("img,video"); m.outerHTML = on ? vids[i] : stills[i]; });
    });
  }

  /* ───────── humans vs agents ───────── */
  const hva = $("#hva");
  if (hva) {
    const groups = [
      { t: "Stealth Labyrinth", u: "fraction of relays activated, ceiling 1.00", max: 1, rows: [
        ["Human pair 2", 0.90, "human"], ["Human pair 1", 0.85, "human"],
        ["Scripted scout + IDQN", 0.28, "script"], ["Scripted scout + IPPO", 0.16, "script"],
        ["Best baseline (QMIX)", 0.21, "agent"], ["Other 7 baselines", 0.00, "agent"]] ,
        note: "Neither permanent lighting nor shared vision lifts the learned teams off zero. A scripted scout does. The missing skill is leading: entering and holding each room in sequence." },
      { t: "Lava Maze", u: "mazes completed per episode", max: 2, rows: [
        ["Human pair 2 (35 eps)", 1.66, "human"], ["Human pair 1 (10 eps)", 0.10, "human"],
        ["Scripted observer + IPPO", 0.97, "script"], ["All 8 baselines", 0.00, "agent"]],
        note: "Remove the need to communicate and MAPPO clears 35.8 mazes per episode. Give it a lossless message channel and it still scores zero. The obstacle is agreeing on what a signal means." },
    ];
    groups.forEach(g => {
      const d = el("div");
      d.innerHTML = `<h3>${g.t}</h3><div class="label">${g.u}</div>`;
      const bars = el("div", { class: "hbars" });
      g.rows.forEach(([n, v, k]) => bars.appendChild(el("div", { class: `hb ${k}${v === 0 ? " zero" : ""}` },
        `<span>${n}</span><span class="track"><span class="fill" style="width:${(v / g.max * 100).toFixed(1)}%"></span></span><span class="val">${v.toFixed(2)}</span>`)));
      d.appendChild(bars);
      d.appendChild(el("p", { style: "margin-top:14px;font-size:.95rem;color:#d8d0cc" }, g.note));
      hva.appendChild(d);
    });
    const key = el("div", { style: "grid-column:1/-1;display:flex;gap:22px;flex-wrap:wrap;font-family:var(--font-hud);font-size:1.15rem;color:var(--khaki)" },
      `<span><i style="display:inline-block;width:12px;height:12px;background:var(--hud);margin-right:6px"></i>humans, no talking, no shared screen</span><span><i style="display:inline-block;width:12px;height:12px;background:var(--khaki);margin-right:6px"></i>one role scripted, one learned</span><span><i style="display:inline-block;width:12px;height:12px;background:var(--blood);margin-right:6px"></i>both roles learned (CTDE baselines)</span>`);
    hva.appendChild(key);
  }

  /* ───────── small SVG charts ───────── */
  const sc = $("#scale-chart");
  if (sc) {
    const D = [[2, 1676.2, 64.3], [3, 1094.4, 41.0], [4, 711.7, 5.8], [6, 430.1, 4.7], [8, 244.5, 8.9]];
    const W = 520, H = 230, L = 46, B = 30, T = 14, bw = 60, max = 1800;
    const y = v => T + (H - T - B) * (1 - v / max);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Environment steps per second by team size"><g class="grid">`;
    [0, 600, 1200, 1800].forEach(v => { s += `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 5}" text-anchor="end">${v}</text>`; });
    s += `</g>`;
    D.forEach(([n, v, best], i) => {
      const x = L + 20 + i * ((W - L - 20) / D.length);
      s += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${y(0) - y(v)}" fill="${i === 0 ? "var(--hud)" : "var(--p2)"}"/>`;
      s += `<text class="v" x="${x + bw / 2}" y="${y(v) - 6}" text-anchor="middle">${Math.round(v)}</text>`;
      s += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">N = ${n}</text>`;
    });
    s += `<text x="${L}" y="${T - 2}" >env steps / s</text></svg>`;
    sc.innerHTML = s;
  }
  const cc = $("#cur-chart");
  if (cc) {
    const C = [["Direct hard", 124.3, 5.44, 4.31], ["Uniform", 75.0, 5.62, 4.81], ["Sequential", 123.2, 6.94, 5.00], ["Learning progress", 25.7, 5.00, 5.00], ["OMNI", 64.3, 5.38, 5.38], ["PLR", 19.1, 5.56, 4.88]];
    function draw(mode) {
      const k = mode === "best" ? 2 : 3;
      const mx = Math.max(...C.map(r => r[k]));
      const W = 520, rowH = 30, L = 140, max = 7.5, H = C.length * rowH + 20;
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Curriculum comparison">`;
      C.forEach((r, i) => {
        const yy = 10 + i * rowH, w = (W - L - 120) * r[k] / max, hl = Math.abs(r[k] - mx) < 1e-9;
        s += `<text x="${L - 10}" y="${yy + 16}" text-anchor="end" class="${hl ? "hl" : "v"}">${r[0]}</text>`;
        s += `<rect x="${L}" y="${yy + 3}" width="${w}" height="18" fill="${hl ? "var(--hud)" : "var(--p1)"}" opacity="${hl ? 1 : .8}"/>`;
        s += `<text x="${L + w + 8}" y="${yy + 17}" class="${hl ? "hl" : "v"}">${r[k].toFixed(2)}${mode === "best" ? `  @ ${r[1]}M` : ""}</text>`;
      });
      cc.innerHTML = s + `</svg>`;
    }
    $$("[data-cur]").forEach(b => b.addEventListener("click", () => { $$("[data-cur]").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); draw(b.dataset.cur); }));
    draw("best");
  }

  /* ───────── footage ───────── */
  const tapes = $("#tapes");
  if (tapes) {
    const T = [
      { t: "Split-screen demo", d: "Two agents, two private cameras, across several scenarios. <a href=\"comrad_vid.mp4\">Full-resolution file</a>.", v: "assets/video/demo_loop.mp4", p: "assets/video/demo_poster.jpg" },
      { t: "Ammo Carrier · IPPO", d: "Top-down trajectory heatmap: the runner settles into a depot-to-hub loop.", v: "assets/video/ammo_ippo.mp4", p: "assets/video/ammo_ippo.jpg" },
      { t: "Ammo Carrier · HAPPO", d: "Same task, centralized updates: the supply loop never forms.", v: "assets/video/ammo_happo.mp4", p: "assets/video/ammo_happo.jpg" },
      { t: "All 13 scenarios, trained", d: "Best-checkpoint rollouts for every scenario, side by side with the first-person views.", s: "trooa1" },
      { t: "Humans vs the unsolved tier", d: "Human pairs learning Stealth Labyrinth and Lava Maze without talking.", s: "playf1" },
      { t: "DoomGen timelapse", d: "From Voronoi seed points to a playable WAD, for one scenario template.", s: "skula1" },
      { t: "Curriculum in action", d: "PLR and sequential progression stepping through the Platform Chain task pool.", s: "sarga1" },
      { t: "Eight-agent Armory Siege", d: "What changes in coordination (and in frame rate) as the team grows to N = 8.", s: "possa1" },
      { t: "Five-minute overview", d: "Recorded talk walking through the benchmark and the main findings.", s: "heada1" },
    ];
    T.forEach(x => {
      const scr = x.v
        ? `<div class="scr"><video src="${x.v}" poster="${x.p}" muted loop playsinline preload="none" aria-label="${x.t}"></video></div>`
        : `<div class="scr static"><span class="soon">COMING SOON</span><img class="spr" src="${SPR}${x.s}.png" alt=""></div>`;
      const t = el("article", { class: "tape" }, `${scr}<div class="meta"><h4>${x.t}</h4><p>${x.d}</p></div>`);
      const v = t.querySelector("video");
      if (v) { t.addEventListener("pointerenter", () => v.play().catch(() => {})); t.addEventListener("pointerleave", () => v.pause()); v.addEventListener("click", () => (v.paused ? v.play() : v.pause())); }
      tapes.appendChild(t);
    });
  }

  /* ───────── BibTeX copy ───────── */
  const cp = $("#copy-bib");
  if (cp) cp.addEventListener("click", async () => {
    const txt = $("#bib").textContent;
    try { await navigator.clipboard.writeText(txt); cp.textContent = "Copied"; }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("#bib")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); cp.textContent = "Selected, press Ctrl/Cmd+C"; }
    setTimeout(() => (cp.textContent = "Copy BibTeX"), 2200);
  });
  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();
})();
