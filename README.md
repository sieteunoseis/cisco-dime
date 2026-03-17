# Cisco DIME Library

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

Session cookies are automatically captured and reused across requests to the same host, avoiding unnecessary re-authentication.

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

## Changelog

### v1.10.0

#### New Features

- **`getMultipleFiles()`** — batch download multiple files in parallel with concurrency control
- **`getOneFileStream()`** — stream large files to disk without buffering in memory
- **`selectLogFilesMulti()`** — query log files across multiple hosts with merged results
- **Custom error types** — `DimeError`, `DimeAuthError`, `DimeNotFoundError`, `DimeTimeoutError`, `DimeRateLimitError` for programmatic error handling
- **Debug logging** — opt-in via `DEBUG=cisco-dime` environment variable
- **Unit tests** — mocked SOAP response tests that run in CI without CUCM credentials

### v1.9.0

#### Bug Fixes

- **Shared mutable state** — options objects were reused across requests, causing race conditions in concurrent calls
- **XML injection** — file names and service log names with special characters (`&`, `<`, etc.) are now properly escaped
- **Missing return after reject** — execution no longer falls through after promise rejection
- **Implicit global variables** — fixed `for` loops in multipart parser that leaked globals
- **Null safety** — `listNodeServiceLogs` no longer crashes when a node has no service logs

#### v1.9.0 New Features

- **TypeScript support** — full type declarations in `types/index.d.ts`
- **ESM support** — `main.mjs` wrapper + `exports` field in `package.json`
- **Named parameters** — `selectLogFiles()` now accepts an options object as an alternative to positional arguments
- **Cookie/session reuse** — `getCookie()`/`setCookie()` with automatic capture from responses
- **Request timeouts** — `AbortController`-based timeouts (default 30s), configurable per request
- **Retry with exponential backoff** — automatic retries on failure/rate limiting (HTTP 429/503)
- **Progress callback** — `getOneFile()` accepts `onProgress` for tracking download progress

#### Cleanup

- Removed `util` dependency (replaced with XML-safe string templating)
- Removed unused `sessionIdArr` variable

## Acknowledgements

This library is made possible by code used from:

[parse-multipart](https://github.com/freesoftwarefactory/parse-multipart)

I would like to thank Cristian Salazar for making his code available!
