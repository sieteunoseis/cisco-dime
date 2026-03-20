# Cisco DIME Library

[![npm version](https://img.shields.io/npm/v/cisco-dime.svg)](https://www.npmjs.com/package/cisco-dime)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/node/v/cisco-dime.svg)](https://nodejs.org)

Simple library to pull files from a Cisco UC Products (VOS) via DIME.

DIME information can be found at
[Log Collection and DimeGetFileService API Reference](https://developer.cisco.com/docs/sxml/#!log-collection-and-dimegetfileservice-api-reference/dimegetfileservice-api).

## Installation

Using npm:

```javascript
npm i -g npm
npm i --save cisco-dime
```

## Requirements

This package uses the built in Fetch API of Node. This feature was first introduced in Node v16.15.0. You may need to enable expermential vm module. Also you can disable warnings with an optional enviromental variable.

Also if you are using self signed certificates on Cisco VOS products you may need to disable TLS verification. This makes TLS, and HTTPS by extension, insecure. The use of this environment variable is strongly discouraged. Please only do this in a lab enviroment.

Suggested enviromental variables:

```env
NODE_OPTIONS=--experimental-vm-modules
NODE_NO_WARNINGS=1
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Usage

### CommonJS

```javascript
const ciscoDime = require("cisco-dime");
```

### ESM

```javascript
import ciscoDime from "cisco-dime";
// or
import { listNodeServiceLogs, selectLogFiles, getOneFile } from "cisco-dime";
```

### TypeScript

Full type declarations are included out of the box.

```typescript
import { listNodeServiceLogs, selectLogFiles, getOneFile, DimeError } from "cisco-dime";
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
    "10/04/22 11:00 AM", // From Date
    "10/05/22 11:05 AM", // To Date
    "Client: (GMT+0:0)Greenwich Mean Time-Europe/London"
  )
  .catch((err) => {
    console.log(err);
  });

console.log(serviceLogs);

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
  { concurrency: 3 }
);

console.log(allLogs); // merged array from both hosts
```

### getOneFile

Retrieves a server or system log file via the DIME protocol. Returns a buffer.

```javascript
const fileBuffer = await ciscoDime
  .getOneFile(
    "10.10.20.1",
    "administrator",
    "ciscopsdt",
    "/var/log/active/platform/cli/ciscotacpub.cap"
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
        console.log(`Downloaded ${bytesRead} bytes${percent ? ` (${percent}%)` : ""}`);
      },
    }
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
  "/var/log/active/platform/cli/ciscotacpub.cap"
);

console.log(stream.filename);        // original path
console.log(stream.contentLength);    // size in bytes (or null)

// Pipe to a file
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

Download multiple files in parallel with concurrency control. Failed downloads return error objects instead of throwing.

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
  }
);

// results[i] is either { data, filename, server } or { error, filename, server }
```

### Cookie/Session Management

Session cookies are automatically captured and reused across requests to the same host and service, avoiding unnecessary re-authentication. Cookies are scoped per SOAP service endpoint — the download service (DimeGetFileService) and log collection service (LogCollectionPortTypeService) maintain separate sessions.

```javascript
// Cookies are managed automatically, but you can also manage them manually:
const { getCookie, setCookie } = require("cisco-dime");

// Check if a session cookie exists for a host
const cookie = getCookie("10.10.20.1");

// Manually set a cookie
setCookie("10.10.20.1", "JSESSIONID=abc123");
```

### Error Handling

All errors are instances of typed error classes for programmatic handling:

```javascript
const { DimeError, DimeAuthError, DimeNotFoundError, DimeTimeoutError, DimeRateLimitError } = require("cisco-dime");

try {
  await ciscoDime.getOneFile("10.10.20.1", "admin", "wrong-password", "/some/file");
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

### Debug Logging

Enable debug output by setting the `DEBUG` environment variable:

```bash
DEBUG=cisco-dime node your-app.js
```

This logs request details, retry attempts, cookie captures, and timing information.

## Configuration Options

All methods accept an optional configuration object as the last parameter:

| Option           | Default | Description                                                  |
| ---------------- | ------- | ------------------------------------------------------------ |
| `timeout`        | `30000` | Request timeout in milliseconds                              |
| `retries`        | `3`     | Number of retry attempts on failure                          |
| `retryDelay`     | `1000`  | Base delay between retries in ms (doubles each attempt)      |
| `onProgress`     | `null`  | Progress callback (getOneFile/getMultipleFiles only)         |
| `concurrency`    | `5`     | Max parallel requests (getMultipleFiles/selectLogFilesMulti) |
| `onFileComplete` | `null`  | Per-file completion callback (getMultipleFiles only)         |

```javascript
// Example with configuration
const result = await ciscoDime.listNodeServiceLogs(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  { timeout: 60000, retries: 5, retryDelay: 2000 }
);
```

## Testing

```bash
# Unit tests (no CUCM required, safe for CI)
npm run test:unit

# Integration tests (requires CUCM credentials in env/test.env)
npm test
```

Note: Integration tests use Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)

---

## CLI

The `cisco-dime` package also ships a command-line interface for discovering service logs, selecting log files by time range or preset, and downloading files from Cisco UC products (VOS) — all without writing any code.

### CLI Installation

```bash
npm install -g cisco-dime
```

### Quick Start

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

### Commands Overview

#### `config`

Manage named cluster configurations and custom presets.

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

#### `list-services`

Discover all nodes in the cluster and their available service log names.

```bash
cisco-dime list-services
cisco-dime list-services --cluster lab
```

```text
Node: cucm-pub.lab.local
  - Cisco CallManager
  - Cisco CTIManager
  - Cisco Audit Event Service
Node: cucm-sub1.lab.local
  - Cisco CallManager
  - Cisco CTIManager
```

#### `select`

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

Active log files (`.gzo` extension — files still being written to by CUCM) are automatically filtered out. Use `--include-active` to include them.

#### `download`

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

| Preset | Service Log Name(s) |
| --- | --- |
| `sip-traces` | Cisco CallManager, Cisco CTIManager |
| `cti-traces` | Cisco CTIManager |
| `curri-logs` | Cisco Extended Functions |
| `syslog` | messages, CiscoSyslog |
| `tomcat` | Tomcat, Tomcat Security |
| `oamp` | Cisco Unified OS Admin, Cisco Unified CM Admin |
| `audit` | Cisco Audit Logs |

Add custom presets with `cisco-dime config add-preset <name> --services "Svc1,Svc2"`. Custom presets can override built-in names.

### Output Formats

Use `--format <format>` (default: `table`) on any command:

| Format | Description |
| ------ | ----------- |
| `table` | Human-readable table (default) |
| `json` | Pretty-printed JSON for scripting |
| `toon` | Token-efficient format for AI agents |
| `csv` | CSV for Excel/spreadsheet workflows |

### Key Flags

| Flag | Description |
| ---- | ----------- |
| `--format table\|json\|toon\|csv` | Output format (default: `table`) |
| `--cluster <name>` | Use a specific named cluster for this command |
| `--host <host>` | Override config/env host |
| `--username <user>` | Override config/env username |
| `--password <pass>` | Override config/env password |
| `--insecure` | Skip TLS certificate verification (lab use only) |
| `--concurrency <n>` | Parallel operations (default: 5) |
| `--output-dir <path>` | Directory to save downloaded files |
| `--organize` | Save files into `<host>/<date>/` subdirectory structure |
| `--decompress` | Gunzip `.gz` files after download |
| `--include-active` | Include active `.gzo` log files (still being written to) |
| `--no-audit` | Disable audit logging for this command |
| `--debug` | Enable debug logging |

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

### Skills.sh Skill

An AI agent skill is available for teaching agents how to use the CLI effectively:

```bash
npx skillsadd sieteunoseis/cisco-dime
```

The skill is located at `skills/cisco-dime-cli/SKILL.md` and covers cluster configuration, preset usage, time-based selection, multi-host queries, the select-then-download workflow, and output format recommendations for AI contexts.

---

## Changelog

### v2.0.0

#### Breaking Changes

- **`selectLogFiles()` and `listNodeServiceLogs()` now always return arrays**, even for single results. Previously, a single result was returned as a bare object. Callers that used `Array.isArray(result) ? result : [result]` can remove that check.

#### New Features

- **CLI** — full command-line interface: `config`, `list-services`, `select`, `download`
- **Built-in presets** — `sip-traces`, `cti-traces`, `curri-logs`, `syslog`, `tomcat`, `oamp`, `audit` + custom presets
- **Flexible time parser** — `30m`, `2h`, `1d`, `now`, ISO 8601, date-time strings
- **Indexed select-then-download workflow** — select results are numbered and cached for easy download by index
- **Multi-cluster config** — named clusters at `~/.cisco-dime/config.json` with Secret Server (`<ss:ID:field>`) support
- **Output formats** — `--format table|json|toon|csv`
- **Active file filtering** — `.gzo` files (still being written to) are skipped by default, `--include-active` to include
- **File organization** — `--organize` saves downloads into `<host>/<date>/` subdirectories
- **Decompression** — `--decompress` gunzips `.gz` files with truncated file detection
- **Streaming for large files** — files >50MB are streamed to disk without buffering in memory
- **Audit trail** — JSONL audit log at `~/.cisco-dime/audit.jsonl` with 10MB rotation
- **skills.sh skill** — AI agent skill at `skills/cisco-dime-cli/SKILL.md`

#### Bug Fixes

- **Session cookie scoping** — cookies are now scoped per SOAP service endpoint (DimeGetFileService vs LogCollectionPortTypeService). Previously, a cookie from `selectLogFiles` would cause HTTP 500 errors on subsequent `getOneFile` calls.
- **Pinned dependencies** — `xml2js` pinned to `^0.6.2`, `dotenv` to `^16.4.5` (was `*`)

### v1.10.0

- **`getMultipleFiles()`** — batch download multiple files in parallel with concurrency control
- **`getOneFileStream()`** — stream large files to disk without buffering in memory
- **`selectLogFilesMulti()`** — query log files across multiple hosts with merged results
- **Custom error types** — `DimeError`, `DimeAuthError`, `DimeNotFoundError`, `DimeTimeoutError`, `DimeRateLimitError` for programmatic error handling
- **Debug logging** — opt-in via `DEBUG=cisco-dime` environment variable
- **Unit tests** — mocked SOAP response tests that run in CI without CUCM credentials

### v1.9.0

- **Shared mutable state** — options objects were reused across requests, causing race conditions in concurrent calls
- **XML injection** — file names and service log names with special characters (`&`, `<`, etc.) are now properly escaped
- **Missing return after reject** — execution no longer falls through after promise rejection
- **Implicit global variables** — fixed `for` loops in multipart parser that leaked globals
- **Null safety** — `listNodeServiceLogs` no longer crashes when a node has no service logs

**New in v1.9.0:**

- **TypeScript support** — full type declarations in `types/index.d.ts`
- **ESM support** — `main.mjs` wrapper + `exports` field in `package.json`
- **Named parameters** — `selectLogFiles()` now accepts an options object as an alternative to positional arguments
- **Cookie/session reuse** — `getCookie()`/`setCookie()` with automatic capture from responses
- **Request timeouts** — `AbortController`-based timeouts (default 30s), configurable per request
- **Retry with exponential backoff** — automatic retries on failure/rate limiting (HTTP 429/503)
- **Progress callback** — `getOneFile()` accepts `onProgress` for tracking download progress

**Cleanup:**

- Removed `util` dependency (replaced with XML-safe string templating)
- Removed unused `sessionIdArr` variable

## Acknowledgements

This library is made possible by code used from:

[parse-multipart](https://github.com/freesoftwarefactory/parse-multipart)

I would like to thank Cristian Salazar for making his code available!
