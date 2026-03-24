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

This package uses the built in Fetch API of Node. This feature was first introduced in Node v16.15.0. You may need to enable experimental vm module. Also you can disable warnings with an optional environmental variable.

If you are using self-signed certificates on Cisco VOS products you may need to disable TLS verification. **Only do this in a lab environment.**

Suggested environmental variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Quick Start

```bash
# 1. Add a cluster config
cisco-dime config add lab --host 10.0.0.1 --username admin --password secret

# 2. Set it as the active cluster
cisco-dime config use lab

# 3. Browse available service logs
cisco-dime list-services

# 4. Select log files (results are numbered and cached)
cisco-dime select sip-traces --last 30m

# 5. Download by index
cisco-dime download 1,2,3
```

Or skip the select step and grab files in one shot:

```bash
cisco-dime select sip-traces --last 30m --download --output-dir ./logs
```

## Configuration

```bash
cisco-dime config add <name> --host <h> --username <u> --password <p>
cisco-dime config use <name>            # set active cluster
cisco-dime config list                  # list all clusters
cisco-dime config show                  # show active cluster (masks passwords)
cisco-dime config remove <name>         # remove a cluster
cisco-dime config test                  # test connectivity to active cluster
cisco-dime config add-preset <name> --services "Svc1,Svc2"
cisco-dime config list-presets          # list built-in + custom presets
cisco-dime config remove-preset <name>  # remove a custom preset
```

### Authentication Precedence

1. CLI flags (`--host`, `--username`, `--password`, `--cluster`)
2. Environment variables (`CUCM_HOST`, `CUCM_USERNAME`, `CUCM_PASSWORD`)
3. Config file (`~/.cisco-dime/config.json`)

```bash
# Using environment variables (useful for CI/CD)
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
cisco-dime select sip-traces --last 30m
```

Config values support `<ss:ID:field>` Secret Server placeholders (resolved via `ss-cli` at runtime). Plain text values work without `ss-cli` installed.

## CLI Commands

### list-services

Discover all nodes in the cluster and their available service log names.

```bash
cisco-dime list-services
cisco-dime list-services --cluster lab
```

### select

Find log files matching a service name or preset within a time window. Results are numbered and cached to `~/.cisco-dime/last-select.json` for use with `download`.

```bash
# By service name
cisco-dime select "Cisco CallManager" --last 30m
cisco-dime select "Cisco CallManager" --from "2026-03-19 08:00" --to "2026-03-19 09:00"

# By preset
cisco-dime select sip-traces --last 2h
cisco-dime select audit --last 1d

# Multi-host
cisco-dime select sip-traces --last 30m --all-nodes
cisco-dime select sip-traces --last 30m --hosts 10.0.0.1,10.0.0.2

# Select and immediately download
cisco-dime select sip-traces --last 30m --download --output-dir ./logs --organize
```

Time values accept flexible formats: `30m`, `2h`, `1d`, `now`, ISO 8601 (`2026-03-19T08:00:00`), or date-time strings (`2026-03-19 08:00`).

**Timezone:** The `--timezone` flag accepts IANA timezone names (e.g., `America/Chicago`). If omitted, your system's local timezone is used.

Active log files (`.gzo` extension — files still being written to by CUCM) are automatically filtered out. Use `--include-active` to include them.

### download

Download files from a prior `select` by index, range, or all at once. Or fetch a specific file directly without a prior select.

```bash
# By index or range (from last select)
cisco-dime download 1,3,5
cisco-dime download 1-5
cisco-dime download --all

# By explicit path (no prior select needed)
cisco-dime download --file "/activelog/cm/trace/..." --host 10.0.0.1

# With options
cisco-dime download --all --output-dir ./logs
cisco-dime download --all --organize          # saves to ./hostname/2026-03-19/filename
cisco-dime download --all --decompress        # gunzips .gz files after download
```

### Built-in Presets

| Preset       | Service Log Name(s)                            |
| ------------ | ---------------------------------------------- |
| `sip-traces` | Cisco CallManager, Cisco CTIManager            |
| `cti-traces` | Cisco CTIManager                               |
| `curri-logs` | Cisco Extended Functions                       |
| `syslog`     | messages, CiscoSyslog                          |
| `tomcat`     | Tomcat, Tomcat Security                        |
| `oamp`       | Cisco Unified OS Admin, Cisco Unified CM Admin |
| `audit`      | Cisco Audit Logs                               |

Add custom presets with `cisco-dime config add-preset <name> --services "Svc1,Svc2"`.

### doctor

```bash
cisco-dime doctor
```

Check DIME connectivity and configuration health.

## Global Flags

| Flag                              | Description                                              |
| --------------------------------- | -------------------------------------------------------- |
| `--format table\|json\|toon\|csv` | Output format (default: `table`)                         |
| `--cluster <name>`                | Use a specific named cluster for this command            |
| `--host <host>`                   | Override config/env host                                 |
| `--username <user>`               | Override config/env username                             |
| `--password <pass>`               | Override config/env password                             |
| `--insecure`                      | Skip TLS certificate verification                        |
| `--concurrency <n>`               | Parallel operations (default: 5)                         |
| `--output-dir <path>`             | Directory to save downloaded files                       |
| `--organize`                      | Save files into `<host>/<date>/` subdirectory structure  |
| `--decompress`                    | Gunzip `.gz` files after download                        |
| `--include-active`                | Include active `.gzo` log files (still being written to) |
| `--no-audit`                      | Disable audit logging for this command                   |
| `--debug`                         | Enable debug logging                                     |

## Output Formats

| Format  | Description                          |
| ------- | ------------------------------------ |
| `table` | Human-readable table (default)       |
| `json`  | Pretty-printed JSON for scripting    |
| `toon`  | Token-efficient format for AI agents |
| `csv`   | CSV for Excel/spreadsheet workflows  |

## Audit Trail

All operations are logged to `~/.cisco-dime/audit.jsonl` (JSONL format). Credentials are never logged. Use `--no-audit` to skip.

## Library API

### Setup

```javascript
// CommonJS
const ciscoDime = require("cisco-dime");

// ESM
import ciscoDime from "cisco-dime";
// or
import { listNodeServiceLogs, selectLogFiles, getOneFile } from "cisco-dime";
```

### TypeScript

Full type declarations are included out of the box.

```typescript
import {
  listNodeServiceLogs,
  selectLogFiles,
  getOneFile,
  DimeError,
} from "cisco-dime";
```

### listNodeServiceLogs

Returns the node names in the cluster and the lists of associated service names.

```javascript
const serviceLogsNames = await ciscoDime
  .listNodeServiceLogs("10.10.20.1", "administrator", "ciscopsdt")
  .catch((err) => {
    console.log(err);
  });

console.log(serviceLogsNames);
```

### selectLogFiles

Lists available service log files based on selection criteria. Supports both positional and named parameters.

```javascript
// Positional parameters
const serviceLogs = await ciscoDime
  .selectLogFiles(
    "10.10.20.1",
    "administrator",
    "ciscopsdt",
    "Cisco CallManager",
    "10/04/22 11:00 AM",
    "10/05/22 11:05 AM",
    "Client: (GMT+0:0)Greenwich Mean Time-Europe/London",
  )
  .catch((err) => {
    console.log(err);
  });

// Named parameters
const serviceLogs = await ciscoDime
  .selectLogFiles({
    host: "10.10.20.1",
    username: "administrator",
    password: "ciscopsdt",
    servicelog: "Cisco CallManager",
    fromdate: "10/04/22 11:00 AM",
    todate: "10/05/22 11:05 AM",
    timezone: "Client: (GMT+0:0)Greenwich Mean Time-Europe/London",
  })
  .catch((err) => {
    console.log(err);
  });
```

### selectLogFilesMulti

Query log files across multiple hosts at once. Results are merged and flattened. Failed hosts are silently skipped.

```javascript
const allLogs = await ciscoDime.selectLogFilesMulti(
  ["10.10.20.1", "10.10.20.2"],
  "administrator",
  "ciscopsdt",
  "Cisco CallManager",
  "10/04/22 11:00 AM",
  "10/05/22 11:05 AM",
  "Client: (GMT-8:0)America/Los_Angeles",
  { concurrency: 3 },
);
```

### getOneFile

Retrieves a server or system log file via the DIME protocol. Returns a buffer.

```javascript
const fileBuffer = await ciscoDime
  .getOneFile(
    "10.10.20.1",
    "administrator",
    "ciscopsdt",
    "/var/log/active/platform/cli/ciscotacpub.cap",
  )
  .catch((err) => {
    console.log(err);
  });

console.log(fileBuffer.filename);
console.log(fileBuffer.data);
console.log(fileBuffer.server);
```

With progress tracking:

```javascript
const fileBuffer = await ciscoDime
  .getOneFile(
    "10.10.20.1",
    "administrator",
    "ciscopsdt",
    "/var/log/active/platform/cli/ciscotacpub.cap",
    {
      onProgress: ({ bytesRead, contentLength, percent }) => {
        console.log(
          `Downloaded ${bytesRead} bytes${percent ? ` (${percent}%)` : ""}`,
        );
      },
    },
  )
  .catch((err) => {
    console.log(err);
  });
```

### getOneFileStream

Returns a readable stream instead of buffering the entire file in memory. Useful for large log files.

```javascript
const stream = await ciscoDime.getOneFileStream(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "/var/log/active/platform/cli/ciscotacpub.cap",
);

console.log(stream.filename);
console.log(stream.contentLength);

const fs = require("fs");
const writer = fs.createWriteStream("./output.cap");
const reader = stream.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  writer.write(Buffer.from(value));
}
writer.end();
```

### getMultipleFiles

Download multiple files in parallel with concurrency control.

```javascript
const results = await ciscoDime.getMultipleFiles(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  [
    "/var/log/active/platform/cli/file1.cap",
    "/var/log/active/platform/cli/file2.cap",
    "/var/log/active/platform/cli/file3.cap",
  ],
  {
    concurrency: 3,
    onFileComplete: (err, result, index) => {
      if (err) {
        console.log(`File ${index} failed:`, err.message);
      } else {
        console.log(`File ${index} done: ${result.filename}`);
      }
    },
  },
);
```

### Cookie/Session Management

Session cookies are automatically captured and reused across requests to the same host and service, avoiding unnecessary re-authentication.

```javascript
const { getCookie, setCookie } = require("cisco-dime");

const cookie = getCookie("10.10.20.1");
setCookie("10.10.20.1", "JSESSIONID=abc123");
```

### Error Handling

All errors are instances of typed error classes for programmatic handling:

```javascript
const {
  DimeError,
  DimeAuthError,
  DimeNotFoundError,
  DimeTimeoutError,
  DimeRateLimitError,
} = require("cisco-dime");

try {
  await ciscoDime.getOneFile(
    "10.10.20.1",
    "admin",
    "wrong-password",
    "/some/file",
  );
} catch (err) {
  if (err instanceof DimeAuthError) {
    console.log("Bad credentials for", err.host);
  } else if (err instanceof DimeTimeoutError) {
    console.log("Request timed out");
  } else if (err instanceof DimeNotFoundError) {
    console.log("File not found");
  } else if (err instanceof DimeRateLimitError) {
    console.log("Rate limited after all retries");
  } else if (err instanceof DimeError) {
    console.log("DIME error:", err.message, "status:", err.statusCode);
  }
}
```

### Configuration Options

All methods accept an optional configuration object as the last parameter:

| Option           | Default | Description                                                  |
| ---------------- | ------- | ------------------------------------------------------------ |
| `timeout`        | `30000` | Request timeout in milliseconds                              |
| `retries`        | `3`     | Number of retry attempts on failure                          |
| `retryDelay`     | `1000`  | Base delay between retries in ms (doubles each attempt)      |
| `onProgress`     | `null`  | Progress callback (getOneFile/getMultipleFiles only)         |
| `concurrency`    | `5`     | Max parallel requests (getMultipleFiles/selectLogFilesMulti) |
| `onFileComplete` | `null`  | Per-file completion callback (getMultipleFiles only)         |

### Debug Logging

```bash
DEBUG=cisco-dime node your-app.js
```

## Testing

```bash
# Unit tests (no CUCM required, safe for CI)
npm run test:unit

# Integration tests (requires CUCM credentials in env/test.env)
npm test
```

Note: Integration tests use Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)

## Changelog

### v2.0.0

#### Breaking Changes

- **`selectLogFiles()` and `listNodeServiceLogs()` now always return arrays**, even for single results.

#### New Features

- **CLI** — full command-line interface: `config`, `list-services`, `select`, `download`
- **Built-in presets** — `sip-traces`, `cti-traces`, `curri-logs`, `syslog`, `tomcat`, `oamp`, `audit` + custom presets
- **Flexible time parser** — `30m`, `2h`, `1d`, `now`, ISO 8601, date-time strings
- **Indexed select-then-download workflow** — select results are numbered and cached for easy download by index
- **Multi-cluster config** — named clusters at `~/.cisco-dime/config.json` with Secret Server support
- **Output formats** — `--format table|json|toon|csv`
- **Active file filtering** — `.gzo` files skipped by default, `--include-active` to include
- **File organization** — `--organize` saves downloads into `<host>/<date>/` subdirectories
- **Decompression** — `--decompress` gunzips `.gz` files with truncated file detection
- **Streaming** — files >50MB are streamed to disk without buffering in memory
- **Audit trail** — JSONL audit log at `~/.cisco-dime/audit.jsonl` with 10MB rotation
- **skills.sh skill** — AI agent skill at `skills/cisco-dime-cli/SKILL.md`

#### Bug Fixes

- **Session cookie scoping** — cookies now scoped per SOAP service endpoint
- **Pinned dependencies** — `xml2js` pinned to `^0.6.2`, `dotenv` to `^16.4.5`

### v1.10.0

- **`getMultipleFiles()`** — batch download with concurrency control
- **`getOneFileStream()`** — stream large files to disk
- **`selectLogFilesMulti()`** — query across multiple hosts
- **Custom error types** — `DimeError`, `DimeAuthError`, `DimeNotFoundError`, `DimeTimeoutError`, `DimeRateLimitError`
- **Debug logging** — opt-in via `DEBUG=cisco-dime`
- **Unit tests** — mocked SOAP response tests for CI

### v1.9.0

- **TypeScript support** — full type declarations
- **ESM support** — `main.mjs` wrapper + `exports` field
- **Named parameters** — `selectLogFiles()` accepts options object
- **Cookie/session reuse** — automatic capture from responses
- **Request timeouts** — `AbortController`-based (default 30s)
- **Retry with exponential backoff** — automatic on failure/rate limiting
- **Progress callback** — `getOneFile()` accepts `onProgress`

## Acknowledgements

This library is made possible by code used from:

[parse-multipart](https://github.com/freesoftwarefactory/parse-multipart) — thanks to Cristian Salazar!

## Giving Back

If you found this helpful, consider:

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://buymeacoffee.com/automatebldrs)

## License

MIT
