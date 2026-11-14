# Station

A visual dashboard for a multi-agent system.

## Run

Use Node 22 and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Without a data file, Station shows sample agents.

## Connect local agents

Station can read Claude Code and Codex session activity through the Forge reporter. Start the bridge and Station in separate terminals:

```sh
FORGE_REPORTER_DIR=../forge-board/reporter pnpm connect-agents
STATION_DATA_FILE=/tmp/station-world.json pnpm dev
```

The bridge refreshes every 20 seconds and writes a local snapshot. It reads agent session files on this computer and does not send prompts, replies, or data to Forge. It needs `uv` and a Forge checkout; `uv` installs the reporter dependencies on its first run. Set `FORGE_REPORTER_DIR` to that checkout's `reporter` directory if it is elsewhere.

Other agent systems can connect by writing a snapshot in the format shown in [examples/world.json](examples/world.json) and setting `STATION_DATA_FILE` to its absolute path. Replace the file atomically when updating it. Station reads it through `/api/worlds` every 20 seconds. Invalid snapshots show an error.

Station displays activity but does not run agents or send replies. The server binds to localhost and has no authentication.

## Development

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```
