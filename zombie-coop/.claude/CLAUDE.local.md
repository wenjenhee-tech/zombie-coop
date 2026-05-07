# Local Environment Notes

## Services (must be running before dev)
- MongoDB: `127.0.0.1:27017`, database `zombie_coop`
- Game server: `http://localhost:5000` (start with `node server.js` in `game-server/`)
- Vite dev server: `http://localhost:5173` (start with `npm run dev` in `game-client/`)

## First-time setup
Run `node init_db.js` in `game-server/` to apply schema validation and indexes from `database/game_schema.json`.

## No test suite
`npm test` in `game-server/` is a placeholder stub. There are no automated tests.
