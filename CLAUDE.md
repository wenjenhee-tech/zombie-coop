# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

This repository contains a single project nested one level deep:

- [zombie-coop/](zombie-coop/) — the entire codebase (Vue + Phaser frontend in `game-client/`, Node.js + Socket.io + MongoDB backend in `game-server/`).

All build, run, and database commands must be issued from inside `zombie-coop/` (or its `game-server/` / `game-client/` subdirs) — the repository root has no `package.json`, no scripts, and no tooling of its own.

## Authoritative Project Documentation

[zombie-coop/CLAUDE.md](zombie-coop/CLAUDE.md) is the detailed guide and should be read before making non-trivial changes. It covers:
- How to start the server (`node server.js` from `game-server/`, port 5000, MongoDB at `mongodb://127.0.0.1:27017/zombie_coop`) and client (`npm run dev` / `npm run build` from `game-client/`).
- First-time DB setup via `node init_db.js` (applies `game-server/database/game_schema.json`).
- The host-authority networking model (the first player in a room runs zombie spawning, AI, and wave logic; everyone else renders).
- The Vue↔Phaser integration pattern (Vue UI overlays a Phaser canvas; Phaser writes back to the shared `store.js` reactive object every frame).
- The four player classes, zombie types, wave config, buff system, and socket event contract.
- MongoDB collection shapes (`users`, `rooms`).

There is no test suite — `npm test` in `game-server/` is a placeholder.

## Notes for Future Edits

- When adding a new top-level project in this repo, add a section here pointing to its directory; do not duplicate its internal docs.
- `zombie-coop/aggregation.json` references files under `backend/controllers/...` that do not exist in this repository (it appears to be a stray export from an unrelated project). Do not assume it reflects current code; verify against the actual `game-server/` source before using it.
