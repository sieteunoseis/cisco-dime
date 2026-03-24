# Cisco DIME Library & CLI

[![npm version](https://img.shields.io/npm/v/cisco-dime.svg)](https://www.npmjs.com/package/cisco-dime)
[![CI](https://github.com/sieteunoseis/cisco-dime/actions/workflows/release.yml/badge.svg)](https://github.com/sieteunoseis/cisco-dime/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/cisco-dime.svg)](https://nodejs.org)
[![Skills](https://img.shields.io/badge/skills.sh-cisco--dime--cli-blue)](https://skills.sh/sieteunoseis/cisco-dime)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-orange?logo=buy-me-a-coffee)](https://buymeacoffee.com/automatebldrs)

A library and CLI to pull log files from Cisco UC Products (VOS) via DIME.

DIME information can be found at
[Log Collection and DimeGetFileService API Reference](https://developer.cisco.com/docs/sxml/#!log-collection-and-dimegetfileservice-api-reference/dimegetfileservice-api).

## Installation

```bash
npm install cisco-dime
```

### Global CLI install

```bash
npm install -g cisco-dime
```

Or run without installing:

```bash
npx cisco-dime --help
```

### AI Agent Skills

```bash
npx skills add sieteunoseis/cisco-dime
```

## Requirements

Node.js 16.15+ required (uses built-in Fetch API). If using self-signed certificates, use the `--insecure` CLI flag or set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Quick Start

```bash
# 1. Add a cluster config
cisco-dime config add lab --host 10.0.0.1 --username admin --password secret --insecure

# 2. Browse available service logs
cisco-dime list-services

# 3. Select log files (results are numbered and cached)
cisco-dime select sip-traces --last 30m

# 4. Download by index
cisco-dime download 1,2,3

# Or do it all in one shot
cisco-dime select sip-traces --last 30m --download --output-dir ./logs
```

## Configuration

```bash
cisco-dime config add <name> --host <h> --username <u> --password <p> [--insecure]
cisco-dime config use <name>       # set active cluster
cisco-dime config list             # list all clusters
cisco-dime config show             # show active cluster (masks passwords)
cisco-dime config remove <name>    # remove a cluster
cisco-dime config test             # test connectivity
```

Auth precedence: CLI flags > env vars (`CUCM_HOST`, `CUCM_USERNAME`, `CUCM_PASSWORD`) > config file.

Config stored at `~/.cisco-dime/config.json`. Supports [ss-cli](https://github.com/sieteunoseis/ss-cli) `<ss:ID:field>` placeholders.

## CLI Commands

| Command | Description |
|---------|-------------|
| `list-services` | Discover nodes and available service logs |
| `select <service\|preset>` | Find log files by service or preset within a time window |
| `download [indices]` | Download files from last select by index, range, or `--all` |
| `doctor` | Check DIME connectivity and health |

Built-in presets: `sip-traces`, `cti-traces`, `curri-logs`, `syslog`, `tomcat`, `oamp`, `audit`

See [full CLI reference](docs/cli.md) for all options, presets, multi-host queries, and download flags.

## Global Flags

| Flag | Description |
|------|-------------|
| `--format table\|json\|toon\|csv` | Output format (default: table) |
| `--cluster <name>` | Use a specific named cluster |
| `--host <host>` | Override config/env host |
| `--insecure` | Skip TLS certificate verification |
| `--concurrency <n>` | Parallel operations (default: 5) |
| `--no-audit` | Disable audit logging |
| `--debug` | Enable debug logging |

## Library API

```javascript
const ciscoDime = require("cisco-dime");

// List available services
const services = await ciscoDime.listNodeServiceLogs("10.10.20.1", "admin", "pass");

// Select log files
const logs = await ciscoDime.selectLogFiles("10.10.20.1", "admin", "pass",
  "Cisco CallManager", "10/04/22 11:00 AM", "10/05/22 11:05 AM");

// Download a file
const file = await ciscoDime.getOneFile("10.10.20.1", "admin", "pass",
  "/var/log/active/platform/cli/ciscotacpub.cap");
```

See [full API documentation](docs/api.md) for all methods, streaming, multi-host queries, error handling, TypeScript, and configuration options.

## Acknowledgements

This library uses code from [parse-multipart](https://github.com/freesoftwarefactory/parse-multipart) -- thanks to Cristian Salazar!

## Changelog

See [docs/changelog.md](docs/changelog.md) for version history.

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
