# cisco-dime CLI & Skills.sh Integration Design

**Date:** 2026-03-19
**Status:** Draft
**Package:** cisco-dime (https://github.com/sieteunoseis/cisco-dime)

## Overview

Add CLI functionality and a skills.sh skill to the existing cisco-dime library package. The CLI provides commands for discovering service logs, selecting log files by time range or preset, and downloading files from Cisco UC products (VOS) via DIME. A skills.sh skill teaches AI agents how to use the CLI effectively.

This is **Phase 1** — core DIME operations only. Phase 2 (SDL trace parsing, SIP ladder diagrams, pcap analysis) will be a separate spec.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Packaging | CLI built into existing package | Single repo, library and CLI always in lockstep. Same pattern as cisco-axl. |
| CLI framework | Commander.js | Consistent with cisco-axl and ss-cli. |
| Command structure | select + download with cached results | User-friendly indexed workflow for file selection. |
| Auth/config | CLI flags > env vars > config file | Same pattern as cisco-axl. Admins get persistent config, devs/CI get env vars. |
| Multi-cluster | Named clusters with `config add/use` | Same pattern as cisco-axl. |
| Secret Server | Optional `<ss:ID:field>` placeholder resolution | Same pattern as cisco-axl. No plaintext passwords on disk if ss-cli is available. |
| Output formats | table, json, toon, csv | table=admins, json=scripting, toon=AI agents, csv=Excel workflows |
| Skills scope | CLI usage skill only | Library API is well-documented via types and JSDoc already. |
| CLI source language | Plain JavaScript (not TypeScript) | CLI code lives in `cli/` and imports the library from `main.js`. Same pattern as cisco-axl. |
| TLS handling | `--insecure` flag for self-signed certs | Most CUCM environments use self-signed certificates. |
| Presets | Built-in + custom user presets | Convenience for common service log types. Custom presets stored in config. |
| Time parsing | Flexible `<number><unit>` parser | Accepts `30m`, `2h`, `1d`, `45m`, `now`, etc. More versatile than fixed keywords. |
| Node discovery | Via `listNodeServiceLogs()` | Built into the library already. No external dependency needed. |
| Select caching | `~/.cisco-dime/last-select.json` | Enables indexed download workflow. |
| File organization | `--organize` flag for host/date structure | Prevents filename collisions in multi-host/batch downloads. |
| Decompression | `--decompress` flag with truncation detection | Differentiator — competitors don't handle truncated `.gz` files. |
| Phased delivery | Phase 1: core DIME ops. Phase 2: analysis | Ship useful CLI fast, add analysis features later. |

## Scope Boundaries

- **In scope (Phase 1):** Service log listing, log file selection, file download, presets, multi-host queries, config management
- **Out of scope (Phase 1):** SDL trace parsing, SIP ladder diagrams, pcap analysis (Phase 2)
- **Out of scope (always):** AXL, RisPort, PerfMon — those stay in their own libraries
- **Existing library consumers** are completely unaffected

## Feature Comparison

How DIME capabilities compare across tools:

| Feature | **cisco-dime CLI** (planned) | **cisco-cucm-mcp** (MCP) | **cucm-cli** (Go) |
|---|---|---|---|
| List service logs | `list-services` | `list_node_service_logs` | - |
| Select logs by date range | `select --from --to` | `select_logs` | - |
| Select logs (last N) | `select --last 30m` | `select_logs_minutes` | - |
| SIP trace preset | `select sip-traces` | `select_sip_traces` | - |
| CTI trace preset | `select cti-traces` | `select_cti_traces` | - |
| CURRI log preset | `select curri-logs` | `select_curri_logs` | - |
| Syslog preset | `select syslog` | `select_syslog_minutes` | - |
| Audit log preset | `select audit` | - | - |
| Tomcat preset | `select tomcat` | - | - |
| OAMP preset | `select oamp` | - | - |
| Custom user presets | `config add-preset` | - | - |
| Download single file | `download 1` / `download --file` | `download_file` | `dime` |
| Download by index | `download 1,3,5` / `download 1-5` | - | - |
| Batch download | `download --all` | `download_batch` (max 20) | - |
| Streaming large files | Yes (>50MB auto-streams) | - | - |
| Multi-host query | `--all-nodes` / `--hosts` | - | - |
| Select + download combo | `select --download` | - | - |
| Progress display | Per-file progress bar | - | - |
| Concurrency control | `--concurrency <n>` | - | - |
| Decompression | `--decompress` with truncation warn | - | - |
| File organization | `--organize` (host/date dirs) | - | - |
| Multi-cluster config | Named clusters | Single cluster | Multi-cluster + keystore |
| Secret Server integration | `<ss:ID:field>` | - | - |
| Output formats | table, json, toon, csv | MCP protocol | json, table, csv, raw |
| Audit trail | JSONL | - | - |
| Flexible time parser | `30m`, `2h`, `1d`, `now` | Minutes only | - |
| SDL trace parsing | Phase 2 | `sdl_trace_parse` | - |
| SIP ladder diagrams | Phase 2 | `sdl_trace_call_flow` | - |
| Pcap analysis | Phase 2 | `pcap_*` (5 tools via tshark) | - |

## Command Structure

```
cisco-dime <command> [subcommand] [options]
```

### Config Commands

```bash
cisco-dime config add <name> --host <h> --username <u> --password <p>
cisco-dime config use <name>           # set active cluster
cisco-dime config list                 # list all clusters
cisco-dime config show                 # show active cluster (masks passwords)
cisco-dime config remove <name>        # remove a cluster
cisco-dime config test                 # test connectivity to active cluster
cisco-dime config add-preset <name> --services "Svc1,Svc2"
cisco-dime config list-presets         # list all presets (built-in + custom)
cisco-dime config remove-preset <name> # remove a custom preset (cannot remove built-in)
```

**Notes:**
- No `--cucm-version` needed — DIME does not require it (unlike AXL)
- `config test` calls `listNodeServiceLogs()` to verify connectivity and credentials

### List Services Command

```bash
cisco-dime list-services
cisco-dime list-services --cluster lab
```

Output shows all nodes in the cluster and their available service logs:
```
Node: cucm-pub.lab.local
  - Cisco CallManager
  - Cisco CTIManager
  - Cisco Audit Event Service
Node: cucm-sub1.lab.local
  - Cisco CallManager
  - Cisco CTIManager
```

### Select Command

Find log files matching criteria. Results are numbered and cached for subsequent download.

```bash
# By service log name
cisco-dime select "Cisco CallManager" --last 30m
cisco-dime select "Cisco CallManager" --from "2026-03-19 08:00" --to "2026-03-19 09:00" --timezone "America/Chicago"

# By preset (built-in or custom)
cisco-dime select sip-traces --last 2h
cisco-dime select audit --last 1d

# Multi-host
cisco-dime select sip-traces --last 30m --all-nodes
cisco-dime select sip-traces --last 30m --hosts 10.0.0.1,10.0.0.2

# Select and immediately download
cisco-dime select sip-traces --last 30m --download
cisco-dime select sip-traces --last 30m --download --output-dir ./logs --organize

# Time keywords
cisco-dime select sip-traces --to now --from "2026-03-19 08:00"
```

**Behavior:**
- Results are numbered and cached to `~/.cisco-dime/last-select.json`
- Output shows index, filename, size, modification date
- `--download` grabs all matched files immediately (saved to current working directory unless `--output-dir` is specified)
- Flexible time parser accepts `30m`, `2h`, `1d`, `45m`, `6h`, `now`, etc.
- `--last <duration>` is shorthand for `--from <now minus duration> --to now`. It is mutually exclusive with `--from`/`--to` — if both are provided, error with a message
- If preset AND service name are both provided, preset wins with a warning
- Multi-service presets (e.g., `sip-traces` maps to 2 services) issue separate `selectLogFiles()` calls per service and merge the results. Combined with `--all-nodes`, this creates an N-services x M-hosts matrix of calls
- `--timezone` accepts IANA timezone names (e.g., `America/Chicago`). The CLI converts these to Cisco's proprietary format (`Client: (GMT-6:0)Central Standard Time-America/Chicago`) before passing to the library. Defaults to system timezone if omitted
- `--all-nodes` discovers nodes via `listNodeServiceLogs()` automatically. Requires that returned node hostnames are DNS-resolvable from the CLI machine
- `--cluster` temporarily overrides the active cluster for the current command without changing the config file

### Download Command

```bash
# By index (from last select)
cisco-dime download 1,3,5
cisco-dime download 1-5
cisco-dime download --all

# By full path (no prior select needed)
cisco-dime download --file "/activelog/cm/trace/..." --host 10.0.0.1

# Options
cisco-dime download 1,3 --output-dir ./logs
cisco-dime download --all --organize          # saves to ./hostname/2026-03-19/filename
cisco-dime download --all --decompress        # gunzips .gz files after download
cisco-dime download --all --output-dir ./logs --organize --decompress
```

**Behavior:**
- Reads cached select results from `~/.cisco-dime/last-select.json`
- Errors if no cached results and no `--file` specified
- Uses `getOneFileStream()` for files >50MB, `getOneFile()` for smaller files (threshold not configurable)
- Files saved to current working directory unless `--output-dir` is specified
- Progress bar shown per file during download
- `--concurrency <n>` controls parallel downloads (default: 5). Also applies to `select --download`
- `--decompress` gunzips `.gz` files; warns if truncated (file still being written to) and keeps the raw file as-is
- `--organize` creates `<host>/<date>/` subfolder structure under the output directory

### Global Flags

```text
--format table|json|toon|csv   (default: table)
--host <host>                  (override config/env)
--username <user>              (override config/env)
--password <pass>              (override config/env)
--cluster <name>               (use a specific named cluster)
--insecure                     (skip TLS certificate verification)
--no-audit                     (disable audit logging for this command)
--concurrency <n>              (parallel operations, default: 5)
--debug                        (enable debug logging)
```

**CLI meta:**
- `cisco-dime --version` — prints the package version (from package.json)
- `cisco-dime --help` — auto-generated by Commander.js

## Configuration & Authentication

### Precedence (highest to lowest)

1. CLI flags (`--host`, `--username`, `--password`, `--cluster`)
2. Environment variables (`CUCM_HOST`, `CUCM_USERNAME`, `CUCM_PASSWORD`)
3. Config file (`~/.cisco-dime/config.json`) — active cluster or `--cluster` named cluster

### Config File Layout

```
~/.cisco-dime/
  config.json       (0600 permissions)
  last-select.json  (cached select results)
  audit.jsonl       (audit trail)
```

```json
{
  "activeCluster": "prod",
  "clusters": {
    "lab": {
      "host": "10.0.0.1",
      "username": "admin",
      "password": "plaintext-or-ss-ref",
      "insecure": true
    },
    "prod": {
      "host": "<ss:2301:host>",
      "username": "<ss:2301:username>",
      "password": "<ss:2301:password>"
    }
  },
  "presets": {
    "my-custom-preset": {
      "services": ["Custom Service A", "Custom Service B"]
    }
  }
}
```

### Secret Server Integration (Optional)

Same as cisco-axl — any value in config can use `<ss:ID:field>` placeholders. Resolved via `ss-cli get <ID> --format json` at runtime. Plain values work without ss-cli installed.

### Environment Variables

```bash
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
cisco-dime select sip-traces --last 30m
```

Both `CUCM_HOST` and `CUCM_HOSTNAME` accepted for compatibility.

## Built-in Presets

| Preset | Service Log Name(s) |
|---|---|
| `sip-traces` | Cisco CallManager, Cisco CTIManager |
| `cti-traces` | Cisco CTIManager |
| `curri-logs` | Cisco Extended Functions |
| `syslog` | messages, CiscoSyslog |
| `tomcat` | Tomcat, Tomcat Security |
| `oamp` | Cisco Unified OS Admin, Cisco Unified CM Admin |
| `audit` | Cisco Audit Event Service |

Custom presets are stored in `config.json` and managed via `config add-preset` / `config remove-preset`. Built-in presets cannot be removed but can be overridden by a custom preset with the same name.

## Time Parser

The flexible time parser accepts:
- Duration: `<number><unit>` where unit is `m` (minutes), `h` (hours), `d` (days) — e.g., `30m`, `2h`, `1d`, `45m`
- Keyword: `now` — current timestamp
- ISO 8601: `2026-03-19T08:00:00`
- Date-time string: `2026-03-19 08:00`

Used by `--last`, `--from`, and `--to` flags.

**Cisco date format conversion:** The library's `selectLogFiles()` passes dates into the SOAP XML envelope as-is. The Cisco LogCollectionService API expects dates in `MM/DD/YY hh:mm AM/PM` format (e.g., `03/19/26 08:00 AM`). The time parser in `cli/utils/time.js` must convert all parsed dates into this format before passing to the library.

**Cisco timezone format conversion:** The library passes the timezone string directly into the SOAP envelope. Cisco expects its proprietary format: `Client: (GMT-6:0)Central Standard Time-America/Chicago`. The CLI accepts IANA timezone names (e.g., `America/Chicago`) and converts them via a lookup table in `cli/utils/time.js`.

## Output Formatting

Four formats via `--format` flag (default: `table`):

### Table (default)
```
$ cisco-dime select sip-traces --last 30m
  #  Filename                                          Size    Modified
  1  /activelog/cm/trace/CTIManager/sdl/001.txt.gz     12KB    2026-03-19 10:15
  2  /activelog/cm/trace/CTIManager/sdl/002.txt.gz     8KB     2026-03-19 10:30
  3  /activelog/cm/trace/CallManager/sdl/001.txt.gz    45KB    2026-03-19 10:22
3 files found
```

### JSON (scriptable)
```json
[
  {"index": 1, "filename": "/activelog/cm/trace/CTIManager/sdl/001.txt.gz", "size": 12288, "modified": "2026-03-19T10:15:00Z", "host": "10.0.0.1"},
  ...
]
```

### TOON (token-efficient for AI agents)
```
[3]{index,filename,size,modified,host}:
  1,/activelog/cm/trace/CTIManager/sdl/001.txt.gz,12288,2026-03-19T10:15:00Z,10.0.0.1
  ...
```

### CSV
```csv
index,filename,size,modified,host
1,/activelog/cm/trace/CTIManager/sdl/001.txt.gz,12288,2026-03-19T10:15:00Z,10.0.0.1
...
```

### Field Mapping (library → CLI output)

| CLI column | Library field | Notes |
| ---------- | ------------- | ----- |
| `index` | (generated) | Sequential number for download references |
| `filename` | `absolutepath` | Full path on CUCM |
| `size` | `filesize` | Parsed from string to human-readable (KB/MB) in table, raw bytes in json/csv/toon |
| `modified` | `modifiedDate` | Formatted for display |
| `host` | `server` | Node hostname from which the file is available |

### Behavior Notes
- Errors always output to stderr as plain text regardless of format
- `list-services` shows node/service hierarchy in table mode, flat list in json/csv/toon

## Error Handling

```bash
# Auth failure
$ cisco-dime select sip-traces --last 30m
Error: Authentication failed. Check username and password.
Hint: Run "cisco-dime config test" to verify your credentials.

# No config set
$ cisco-dime select sip-traces --last 30m
Error: No cluster configured. Set one up with:
  cisco-dime config add <name> --host <h> --username <u> --password <p>
  Or set environment variables: CUCM_HOST, CUCM_USERNAME, CUCM_PASSWORD

# No cached select results
$ cisco-dime download 1
Error: No cached select results. Run "cisco-dime select" first.

# Invalid preset
$ cisco-dime select fake-preset --last 30m
Error: Preset "fake-preset" not found.
Hint: Run "cisco-dime config list-presets" to see available presets.

# ss-cli not available
$ cisco-dime select sip-traces --last 30m
Error: Config contains Secret Server references (<ss:...>) but ss-cli is not available.
Install with: npm install -g @sieteunoseis/ss-cli

# Truncated .gz during decompress
$ cisco-dime download 1 --decompress
Warning: File "001.txt.gz" appears truncated (may still be written to). Saved as-is without decompression.

# Node hostname not resolvable (--all-nodes)
$ cisco-dime select sip-traces --last 30m --all-nodes
Error: Could not resolve hostname "cucm-sub2.lab.local" discovered via --all-nodes.
Hint: Ensure CUCM node hostnames are DNS-resolvable, or use --hosts with IP addresses instead.
```

**Behavior:**
- Errors go to stderr, always plain text regardless of `--format`
- Exit code 0 on success, 1 on error
- Actionable hints where possible
- `--debug` flag enables the library's debug logging (`DEBUG=cisco-dime`)

## Audit Trail

All CLI operations are logged to `~/.cisco-dime/audit.jsonl`.

```json
{"timestamp":"2026-03-19T18:30:00.000Z","cluster":"prod","command":"select","args":"sip-traces --last 30m","duration_ms":245,"status":"success","files":3}
{"timestamp":"2026-03-19T18:30:05.000Z","cluster":"prod","command":"download","args":"1,2,3","duration_ms":1200,"status":"success","files":3,"totalBytes":65536}
```

**What's logged:** Timestamp, cluster name, command, duration, status, file count, total bytes (for downloads).
**Never logged:** Passwords, credentials, file contents.
**Controls:** `--no-audit` flag disables logging. Rotation at 10MB — when file exceeds 10MB at write time, rotated to `audit.jsonl.1` (keeps last 2 files).

## File Structure

```
cisco-dime/
├── bin/
│   └── cisco-dime.js              # CLI entry point (#!/usr/bin/env node)
├── cli/
│   ├── index.js                   # Commander program setup, global flags
│   ├── commands/
│   │   ├── config.js              # config add/use/list/show/remove/test/add-preset/list-presets/remove-preset
│   │   ├── select.js              # select <service|preset> with time/host options + --download
│   │   ├── download.js            # download by index, range, --all, or --file
│   │   └── list-services.js       # list-services (node + service log discovery)
│   ├── formatters/
│   │   ├── table.js               # table output using cli-table3
│   │   ├── json.js                # JSON output (pretty-print)
│   │   ├── toon.js                # TOON output using @toon-format/toon
│   │   └── csv.js                 # CSV output using csv-stringify
│   └── utils/
│       ├── config.js              # config file read/write, ss-cli resolution, preset management
│       ├── connection.js          # precedence logic (flags > env > config), creates library calls
│       ├── audit.js               # JSONL audit trail logging and rotation
│       ├── output.js              # format dispatch, error printing with hints
│       ├── time.js                # flexible time parser (30m, 2h, 1d, now)
│       ├── cache.js               # last-select.json read/write
│       └── decompress.js          # .gz decompression with truncation detection
├── skills/
│   └── cisco-dime-cli/
│       └── SKILL.md               # skills.sh skill definition
├── lib/                           # existing library (unchanged)
│   ├── DimeGetFileService.js
│   ├── errors.js
│   └── multipart.js
├── main.js                        # existing (unchanged)
├── main.mjs                       # existing (unchanged)
├── types/
│   └── index.d.ts                 # existing (unchanged)
├── package.json                   # adds bin field + new deps
└── ...
```

## New Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI framework (same as cisco-axl, ss-cli) |
| `cli-table3` | Table output formatting |
| `@toon-format/toon` | TOON output format |
| `csv-stringify` | CSV output format |

## package.json Changes

```json
{
  "bin": {
    "cisco-dime": "./bin/cisco-dime.js"
  }
}
```

New deps added to `dependencies` (not devDependencies). Library consumers who only `import`/`require` the library never load CLI code.

## Skills.sh Integration

### Skill Location
`skills/cisco-dime-cli/SKILL.md`

### Installation
```bash
npx skillsadd sieteunoseis/cisco-dime
```

### Skill Content Covers
- How to configure a cluster (`cisco-dime config add ...` or env vars)
- Listing available service logs (`cisco-dime list-services`)
- Using presets vs. raw service log names
- Time-based selection (`--last`, `--from/--to`)
- Multi-host queries (`--all-nodes`)
- The select-then-download indexed workflow
- One-command grab (`select --download`)
- Output format recommendation (`--format toon` for AI, `--format json` if parsing needed)
- Common debugging patterns (e.g., "grab SIP traces from last 30 minutes across all nodes")

## Future Scope (Phase 2)

Features planned for a separate spec and implementation cycle:

- **SDL trace parsing** — parse SDL trace files into structured signal data
- **SIP ladder diagrams** — render SIP call flows as ASCII or HTML ladder diagrams from SDL traces
- **Pcap analysis** — call summary, SIP flows, RTP quality analysis via tshark integration
- **`cisco-dime analyze <command>`** — new command group for all analysis features

## Reusable Patterns from cisco-axl

This design reuses patterns established in cisco-axl:

| Pattern | Description |
|---------|-------------|
| CLI in the library package | `bin/` entry point, `cli/` directory, library unchanged |
| Commander.js framework | Consistent across all Cisco CLIs |
| Multi-cluster config | `~/.cisco-<lib>/config.json` with named clusters |
| Config precedence | CLI flags > env vars > config file |
| `<ss:ID:field>` support | Optional Secret Server integration |
| Output formats | `--format table\|json\|toon\|csv` |
| Skills.sh skill | `skills/<lib>-cli/SKILL.md` |
| Error handling | Library errors to stderr with actionable hints |
| `--debug` flag | Enables library debug logging |
| `--concurrency` flag | Configurable parallel operations |
| Audit trail | `~/.cisco-<lib>/audit.jsonl` with JSONL logging |
| `CUCM_HOSTNAME` alias | Accept both `CUCM_HOST` and `CUCM_HOSTNAME` env vars |
