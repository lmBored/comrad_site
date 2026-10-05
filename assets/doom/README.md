# Browser Doom bundle

This directory is the complete runtime bundle used by the static COMRAD play
section. `doom_browser.js` loads every file from this directory; the deployed
page does not contact a game server.

- `gzdoom.js`, `gzdoom.wasm`, `engine.worker.js`, and the support PK3 files are
  the prebuilt WebAssembly browser runtime from
  [`mungus43/tomb-engine`](https://github.com/mungus43/tomb-engine), commit
  `6c735315b8ac1b1dd6646ac78c46bbbdbb775a5c`.
- The engine is GPLv3. The corresponding source and license are available in
  the upstream repository; this site does not modify the engine binary.
- `freedoom2.wad` is the free Freedoom IWAD used by COMRAD's native launcher.
- `stag_hunt_arena.wad` is the COMRAD scenario PWAD copied from
  `comrad/scenarios/`.
- `bots.cfg` is the local Rambo bot definition copied from `comrad/play/`.
- `bot_start.cfg` binds F6 to `addbot Rambo`; the browser sends that key after
  MAP01 is active because GZDoom rejects bot creation during startup.

The page hosts one local Doom player and adds Rambo after `MAP01` starts. The
browser build has no second-client or network-multiplayer UI.

The port currently targets Chromium/WebGL2 because its browser harness uses
`OffscreenCanvas` and WebAssembly JSPI. The older JavaScript remake remains in
the site bundle for development/reference, but the Play section uses the real
WAD launcher.
