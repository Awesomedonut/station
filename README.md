# Station

A visual dashboard for a multi-agent system, with Donut and Marble + Donut skins.

## Run

Use Node 22 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000/worlds](http://localhost:3000/worlds). Without a data file, Station shows sample agents.

## Agent data

Set `STATION_DATA_FILE` to the absolute path of your system's JSON snapshot:

```sh
STATION_DATA_FILE=/path/to/world.json pnpm dev
```

See [examples/world.json](examples/world.json) for the format. Replace the file atomically when updating it. Station reads it through `/api/worlds` every 20 seconds. Invalid snapshots show an error; agent links open in your system.

Station displays activity but does not run agents or send replies. The server binds to localhost and has no authentication.

## Development

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

The worlds renderer comes from [forge-board](https://github.com/AlexLisong/forge-board/tree/8cb815d31e2a2e541d3c1b6508c40a230e34fc0d/src/modules/agentworld).
