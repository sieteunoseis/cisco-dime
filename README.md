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

## Usage

In Node.js:

```javascript
const ciscoDime = require("cisco-dime");

// The listNodeServiceLogs method returns the node names in the cluster and the lists of associated service names.
(async () => {
  var serviceLogsNames = await ciscoDime
    .listNodeServiceLogs("10.10.20.1", "administrator", "ciscopsdt")
    .catch((err) => {
      console.log(err);
    });

  console.log(serviceLogsNames);
})();

// The selectLogFiles method lists available service log files, or requests 'push' delivery of service log files based on a selection criteria.
(async () => {
  let serviceLogs = await ciscoDime
    .selectLogFiles(
      "10.10.20.1",
      "administrator",
      "ciscopsdt",
      "Cisco CallManager",
      "10/04/22 11:00 AM", // From Date
      "10/05/22 11:05 AM", // To Date
      "Client: (GMT+0:0)Greenwich Mean Time-Europe/London" // "Client: (GMT-8:0)America/Los_Angeles"
    )
    .catch((err) => {
      console.log(err);
    });

  console.log(serviceLogs);
})();

// The DimeGetFileService API is used to retrieve either a server or system log file through the standard Direct Internet Message Encapsulation (DIME) protocol.
// Note: this function returns a buffer
(async () => {
  let fileBuffer = await ciscoDime
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
})();
```

## Examples

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. Find more information here: [Cisco DevNet](https://devnetsandbox.cisco.com/)

## Acknowledgements

This library is made possible by code used from:

[parse-multipart](https://github.com/freesoftwarefactory/parse-multipart)

I would like to thank Cristian Salazar for making his code available!
