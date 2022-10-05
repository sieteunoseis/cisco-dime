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
const ciscoSoap = require("cisco-dime");

(async () => {
  var serviceLogs = await ciscoSoap
    .listNodeServiceLogs("10.10.20.1", "administrator", "ciscopsdt")
    .catch((err) => {
      console.log(err);
    });

  console.log(serviceLogs);
})();
```

## Examples

```javascript
npm run test
```

Note: Test are using Cisco's DevNet sandbox information. [Cisco DevNet](https://devnetsandbox.cisco.com/)

## Acknowledgements

This library is made possible by code used from:

[parse-multipart](https://github.com/freesoftwarefactory/parse-multipart)

I would like to thank Cristian Salazar for making his code available!
