/* Run the real COMRAD WAD in the browser.
 *
 * The engine is a GZDoom-family WebAssembly build.  The worker keeps the
 * engine and WebGL context off the page's main thread; this file only owns
 * the page UI, local asset loading, and input forwarding.
 */
(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const stage = document.getElementById("arcade");
  const startButton = document.getElementById("doom-start");
  const status = document.getElementById("doom-status");
  const lockButton = document.getElementById("doom-lock");
  const lockStatus = document.getElementById("doom-lock-status");
  if (!canvas || !stage || !startButton || !status || !lockButton || !lockStatus) return;

  window.COMRAD_REAL_WAD_ACTIVE = true;

  const BASE = "assets/doom/";
  const WIDTH = 640;
  const HEIGHT = 360;
  const ASSETS = [
    "freedoom2.wad",
    "stag_hunt_arena.wad",
    "bots.cfg",
    "gzdoom.pk3",
    "brightmaps.pk3",
    "game_support.pk3",
    "game_widescreen_gfx.pk3",
    "lights.pk3",
  ];
  const KEY_BUTTONS = { left: "KeyA", up: "KeyW", down: "KeyS", right: "KeyD", fire: "ControlLeft" };
  let worker = null;
  let started = false;
  let ready = false;
  let botTimer = null;

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.state = kind || "info";
  }

  function keyInit(event) {
    return {
      code: event.code,
      key: event.key,
      keyCode: event.keyCode,
      which: event.which,
      charCode: event.charCode || 0,
      repeat: !!event.repeat,
      shiftKey: !!event.shiftKey,
      ctrlKey: !!event.ctrlKey,
      altKey: !!event.altKey,
      metaKey: !!event.metaKey,
      location: event.location,
      bubbles: true,
      cancelable: true,
    };
  }

  function sendKey(code, type, extra) {
    if (!worker || !ready) return;
    const details = extra || {};
    worker.postMessage({
      type: "input",
      target: "window",
      evType: type,
      init: {
        code,
        key: details.key || (code === "ControlLeft" ? "Control" : code),
        keyCode: details.keyCode || (code === "ControlLeft" ? 17 : 0),
        which: details.which || details.keyCode || (code === "ControlLeft" ? 17 : 0),
        charCode: details.charCode || 0,
        shiftKey: !!details.shiftKey,
        ctrlKey: !!details.ctrlKey,
        altKey: !!details.altKey,
        metaKey: !!details.metaKey,
        location: details.location || (code === "ControlRight" ? 2 : 0),
        bubbles: true,
        cancelable: true,
      },
    });
  }

  // GZDoom's bot command is intentionally issued after the engine has entered
  // the map. A +addbot command in the startup arguments runs too early (before
  // there is a game), so type the same command a player would enter in the
  // local console. This keeps the page to one human and one local bot; no
  // second browser client or network connection is created.
  function consoleKey(code, key, keyCode, type, charCode) {
    sendKey(code, type, { key, keyCode, charCode, which: keyCode });
  }

  function consoleCommand(command) {
    if (!worker || !ready) return;
    consoleKey("Backquote", "`", 192, "keydown");
    consoleKey("Backquote", "`", 192, "keyup");
    for (const character of command) {
      let code = "Unknown";
      let keyCode = character.charCodeAt(0);
      if (/^[a-z]$/i.test(character)) code = `Key${character.toUpperCase()}`;
      else if (/^[0-9]$/.test(character)) code = `Digit${character}`;
      else if (character === " ") { code = "Space"; keyCode = 32; }
      else if (character === "-") { code = "Minus"; keyCode = 189; }
      consoleKey(code, character, keyCode, "keydown");
      if (character !== " ") consoleKey(code, character, keyCode, "keypress", keyCode);
      consoleKey(code, character, keyCode, "keyup");
    }
    consoleKey("Enter", "Enter", 13, "keydown");
    consoleKey("Enter", "Enter", 13, "keyup");
    // Leave the gameplay view visible if the engine keeps the console open
    // after accepting the command.
    setTimeout(() => {
      if (!worker || !ready) return;
      consoleKey("Backquote", "`", 192, "keydown");
      consoleKey("Backquote", "`", 192, "keyup");
    }, 75);
  }

  function gameplayKey(event) {
    if (!worker || !ready) return;
    if (event.code === "F5" || event.code === "F11") return;
    worker.postMessage({ type: "input", target: "window", evType: event.type, init: keyInit(event) });
    event.preventDefault();
  }

  function mouseInit(event, rect) {
    return {
      clientX: (event.clientX - rect.left) * (WIDTH / rect.width),
      clientY: (event.clientY - rect.top) * (HEIGHT / rect.height),
      offsetX: (event.offsetX || 0) * (WIDTH / rect.width),
      offsetY: (event.offsetY || 0) * (HEIGHT / rect.height),
      movementX: event.movementX || 0,
      movementY: event.movementY || 0,
      button: event.button,
      buttons: event.buttons,
      deltaX: event.deltaX || 0,
      deltaY: event.deltaY || 0,
      deltaZ: event.deltaZ || 0,
      shiftKey: !!event.shiftKey,
      ctrlKey: !!event.ctrlKey,
      altKey: !!event.altKey,
      metaKey: !!event.metaKey,
      bubbles: true,
      cancelable: true,
    };
  }

  function forwardMouse(event) {
    if (!worker || !ready) return;
    worker.postMessage({
      type: "input",
      target: "canvas",
      evType: event.type,
      init: mouseInit(event, canvas.getBoundingClientRect()),
    });
    if (event.type === "wheel") event.preventDefault();
  }

  function updateLockStatus() {
    const locked = document.pointerLockElement === canvas;
    lockButton.textContent = locked ? "Unlock mouse" : "Lock mouse";
    lockButton.setAttribute("aria-pressed", String(locked));
    lockStatus.textContent = locked
      ? "Mouse locked · press Esc to release"
      : "Click the view or Lock mouse for mouse look.";
  }

  function lockMouse() {
    if (!ready) return;
    canvas.focus();
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
      return;
    }
    if (!canvas.requestPointerLock) {
      lockStatus.textContent = "Pointer lock is unavailable in this browser.";
      return;
    }
    try {
      const request = canvas.requestPointerLock();
      if (request && typeof request.catch === "function") request.catch(() => {
        lockStatus.textContent = "Mouse lock was refused; click the game view and try again.";
      });
    } catch (_) {
      lockStatus.textContent = "Mouse lock was refused; click the game view and try again.";
    }
  }

  function installInput() {
    window.addEventListener("keydown", gameplayKey, true);
    window.addEventListener("keyup", gameplayKey, true);
    ["mousedown", "mousemove", "mouseup", "wheel"].forEach((type) => {
      canvas.addEventListener(type, forwardMouse, { passive: false });
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    canvas.addEventListener("click", () => {
      if (document.pointerLockElement !== canvas) lockMouse();
    });
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === canvas;
      if (worker) worker.postMessage({ type: "pointerlock", locked });
      updateLockStatus();
    });
    document.addEventListener("pointerlockerror", () => {
      lockStatus.textContent = "Mouse lock was refused; click the game view and try again.";
    });
    document.addEventListener("visibilitychange", () => {
      if (worker) worker.postMessage({ type: "visibility", state: document.visibilityState });
    });

    document.querySelectorAll("#touchpad [data-k]").forEach((button) => {
      const code = KEY_BUTTONS[button.dataset.k];
      if (!code) return;
      const press = (event) => {
        event.preventDefault();
        sendKey(code, "keydown");
      };
      const release = (event) => {
        event.preventDefault();
        sendKey(code, "keyup");
      };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    });
  }

  async function fetchAsset(name) {
    const url = new URL(BASE + name, document.baseURI);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (location.protocol === "file:") {
        throw new Error(`${name}: local file pages cannot fetch WAD assets. Serve comrad_site with a web server, e.g. python -m http.server 8000 --directory comrad_site`);
      }
      throw new Error(`${name}: ${error.message || "network fetch failed"} (${url.href})`);
    }
  }

  function handleWorkerMessage(message) {
    if (message.type === "ready") {
      ready = true;
      lockButton.disabled = false;
      stage.classList.add("running");
      setStatus("Running the real stag_hunt_arena.wad · starting local Rambo bot…", "ok");
      updateLockStatus();
      botTimer = setTimeout(() => {
        botTimer = null;
        consoleCommand("addbot Rambo");
        setStatus("Running Stag Hunt Arena · 1 human + local Rambo bot", "ok");
      }, 1500);
    } else if (message.type === "log" && message.stream === "stderr") {
      console.warn("[COMRAD WAD]", message.msg);
      if (/error|failed|cannot|abort/i.test(message.msg)) setStatus(message.msg, "error");
    } else if (message.type === "abort" || message.type === "error") {
      ready = false;
      setStatus(`WASM engine stopped: ${message.reason || message.message}`, "error");
      startButton.disabled = false;
    }
  }

  async function start() {
    if (started) return;
    started = true;
    startButton.disabled = true;
    setStatus("Loading the browser Doom engine and local WAD files…", "info");
    if (typeof OffscreenCanvas === "undefined" || typeof Worker === "undefined") {
      setStatus("This browser lacks Worker/OffscreenCanvas support; use Chromium/Edge or the native backend.", "error");
      startButton.disabled = false;
      started = false;
      window.COMRAD_REAL_WAD_ACTIVE = false;
      return;
    }
    try {
      // Load one file at a time. Besides making failures identify the exact
      // asset, this avoids several large WAD/PK3 responses competing for the
      // browser's local-file or development-server connection pool.
      const values = [];
      for (const name of ASSETS) {
        setStatus(`Loading ${name}…`, "info");
        values.push(await fetchAsset(name));
      }
      const files = {
        "/freedoom2.wad": values[0],
        "/stag_hunt_arena.wad": values[1],
        "/bots.cfg": values[2],
        "/gzdoom.pk3": values[3],
        "/brightmaps.pk3": values[4],
        "/game_support.pk3": values[5],
        "/game_widescreen_gfx.pk3": values[6],
        "/lights.pk3": values[7],
      };
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const offscreen = canvas.transferControlToOffscreen();
      const workerUrl = new URL("assets/doom/engine.worker.js", document.baseURI);
      worker = new Worker(workerUrl, { type: "classic" });
      worker.onmessage = (event) => handleWorkerMessage(event.data);
      worker.onerror = (event) => {
        setStatus(`WASM worker error: ${event.message || "unknown error"}`, "error");
        console.error(event);
      };
      worker.postMessage({
        type: "boot",
        canvas: offscreen,
        pinW: WIDTH,
        pinH: HEIGHT,
        args: [
          "-iwad", "freedoom2.wad",
          "-file", "stag_hunt_arena.wad",
          "-host", "1",
          "+viz_bots_path", "bots.cfg",
          "+map", "MAP01",
          "-skill", "3",
          "+vid_rendermode", "4",
          "+vid_preferbackend", "1",
          "+vid_fullscreen", "0",
          "+vid_defwidth", String(WIDTH),
          "+vid_defheight", String(HEIGHT),
          "+win_w", String(WIDTH),
          "+win_h", String(HEIGHT),
          "+vid_vsync", "0",
          "+vid_maxfps", "60",
          "+set", "uiscale", "0",
          "+set", "st_scale", "0",
          "+set", "screenblocks", "10",
          "+set", "snd_mididevice", "0",
          "+set", "sv_cheats", "1",
        ],
        files,
        devMode: false,
      }, [offscreen, ...Object.values(files).map((bytes) => bytes.buffer)]);
      installInput();
      setStatus("Engine booting…", "info");
    } catch (error) {
      started = false;
      startButton.disabled = false;
      setStatus(`Could not start the local WAD: ${error.message}`, "error");
      console.error(error);
    }
  }

  startButton.addEventListener("click", start);
  lockButton.addEventListener("click", lockMouse);
  updateLockStatus();
  setStatus("Static browser build · no backend required. Start the real WAD when ready.", "info");
})();
