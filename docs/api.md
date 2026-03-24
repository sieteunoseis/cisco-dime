# Library API Reference

## Setup

```javascript
// CommonJS
const ciscoDime = require("cisco-dime");

// ESM
import ciscoDime from "cisco-dime";
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

## Methods

### listNodeServiceLogs

Returns the node names in the cluster and the lists of associated service names.

```javascript
const serviceLogsNames = await ciscoDime
  .listNodeServiceLogs("10.10.20.1", "administrator", "ciscopsdt")
  .catch((err) => console.log(err));
```

### selectLogFiles

Lists available service log files based on selection criteria. Supports both positional and named parameters.

```javascript
// Positional parameters
const serviceLogs = await ciscoDime.selectLogFiles(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "Cisco CallManager",
  "10/04/22 11:00 AM",
  "10/05/22 11:05 AM",
  "Client: (GMT+0:0)Greenwich Mean Time-Europe/London",
);

// Named parameters
const serviceLogs = await ciscoDime.selectLogFiles({
  host: "10.10.20.1",
  username: "administrator",
  password: "ciscopsdt",
  servicelog: "Cisco CallManager",
  fromdate: "10/04/22 11:00 AM",
  todate: "10/05/22 11:05 AM",
  timezone: "Client: (GMT+0:0)Greenwich Mean Time-Europe/London",
});
```

### selectLogFilesMulti

Query log files across multiple hosts at once. Results are merged and flattened.

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

Retrieves a log file via the DIME protocol. Returns a buffer.

```javascript
const fileBuffer = await ciscoDime.getOneFile(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "/var/log/active/platform/cli/ciscotacpub.cap",
);

console.log(fileBuffer.filename);
console.log(fileBuffer.data);
```

With progress tracking:

```javascript
const fileBuffer = await ciscoDime.getOneFile(
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
);
```

### getOneFileStream

Returns a readable stream instead of buffering. Useful for large log files.

```javascript
const stream = await ciscoDime.getOneFileStream(
  "10.10.20.1",
  "administrator",
  "ciscopsdt",
  "/var/log/active/platform/cli/ciscotacpub.cap",
);

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
  ["/var/log/file1.cap", "/var/log/file2.cap"],
  {
    concurrency: 3,
    onFileComplete: (err, result, index) => {
      console.log(
        err ? `${index} failed` : `${index} done: ${result.filename}`,
      );
    },
  },
);
```

## Cookie/Session Management

Session cookies are automatically captured and reused across requests.

```javascript
const { getCookie, setCookie } = require("cisco-dime");
const cookie = getCookie("10.10.20.1");
setCookie("10.10.20.1", "JSESSIONID=abc123");
```

## Error Handling

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
  if (err instanceof DimeAuthError)
    console.log("Bad credentials for", err.host);
  else if (err instanceof DimeTimeoutError) console.log("Request timed out");
  else if (err instanceof DimeNotFoundError) console.log("File not found");
  else if (err instanceof DimeRateLimitError) console.log("Rate limited");
  else if (err instanceof DimeError) console.log("DIME error:", err.message);
}
```

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

## Debug Logging

```bash
DEBUG=cisco-dime node your-app.js
```
