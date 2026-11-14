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

Station can show your Claude Code and Codex sessions. Start the bridge and Station in separate terminals, using the same data file path in both:

```sh
STATION_DATA_FILE=/tmp/station-world.json pnpm connect-agents
STATION_DATA_FILE=/tmp/station-world.json pnpm dev
```

The bridge scans `~/.claude/projects` and `~/.codex/sessions` every 20 seconds and writes a snapshot of sessions active in the last 3 days. Sessions are grouped by the git repository they ran in. Everything stays on your computer: the bridge keeps only each session's status, title and folder, and sends nothing over the network.

| Variable               | Default                      | Purpose                       |
| ---------------------- | ---------------------------- | ----------------------------- |
| `STATION_DATA_FILE`    | `station-world.json` in temp | Where the snapshot is written |
| `STATION_REFRESH_MS`   | `20000`                      | How often to rescan           |
| `STATION_DAYS`         | `3`                          | How far back to look          |
| `STATION_MACHINE_NAME` | This computer's name         | Name shown on the dashboard   |

Other agent systems can connect by writing a snapshot in the format shown in [examples/world.json](examples/world.json) and setting `STATION_DATA_FILE` to its absolute path. Replace the file atomically when updating it. Station reads it through `/api/worlds` every 20 seconds. Invalid snapshots show an error.

Station displays activity but does not run agents or send replies. The server binds to localhost and has no authentication.

## Development

```sh
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

## License

Station is licensed under the [GNU Affero General Public License v3.0](LICENSE). For commercial licensing, open an issue.
