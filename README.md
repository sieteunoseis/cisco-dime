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
import { listNodeServiceLogs, selectLogFiles, getOneFile } from "cisco-dime";
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

## Configuration Options

All methods accept an optional configuration object as the last parameter:

| Option       | Default | Description                                              |
| ------------ | ------- | -------------------------------------------------------- |
| `timeout`    | `30000` | Request timeout in milliseconds                          |
| `retries`    | `3`     | Number of retry attempts on failure                      |
| `retryDelay` | `1000`  | Base delay between retries in ms (doubles each attempt)  |
| `onProgress` | `null`  | Progress callback (getOneFile only)                      |

```javascript
// Example with configuration
const result = await ciscoDime.listNodeServiceLogs(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  { timeout: 60000, retries: 5, retryDelay: 2000 }
);
```

## Examples

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)

## Changelog

### v1.9.0

#### Bug Fixes

- **Shared mutable state** — options objects were reused across requests, causing race conditions in concurrent calls
- **XML injection** — file names and service log names with special characters (`&`, `<`, etc.) are now properly escaped
- **Missing return after reject** — execution no longer falls through after promise rejection
- **Implicit global variables** — fixed `for` loops in multipart parser that leaked globals
- **Null safety** — `listNodeServiceLogs` no longer crashes when a node has no service logs

#### New Features

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
