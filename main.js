/*jshint esversion: 11 */
var dimeFileService = require("./lib/DimeGetFileService");
var multipart = require("./lib/multipart");
var parseString = require("xml2js").parseString;
var errors = require("./lib/errors");

function parseXml(xmlPart) {
  return new Promise((resolve, reject) => {
    parseString(
      xmlPart,
      { explicitArray: false, explicitRoot: false },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
}

const keyExists = (obj, key) => {
  if (!obj || (typeof obj !== "object" && !Array.isArray(obj))) {
    return false;
  } else if (obj.hasOwnProperty(key)) {
    return true;
  } else if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = keyExists(obj[i], key);
      if (result) {
        return result;
      }
    }
  } else {
    for (const k in obj) {
      const result = keyExists(obj[k], key);
      if (result) {
        return result;
      }
    }
  }

  return false;
};

function sanitizeOutput(array, key, value) {
  let validArr = Array.isArray(array);
  if (validArr) {
    let newData = array.map((o) =>
      Object.keys(o).reduce((a, b) => ((a[b.substring(4)] = o[b]), a), {})
    );
    newData.map((o) => (o[key] = value));
    return newData;
  } else {
    let newData = Object.keys(array).reduce(
      (a, b) => ((a[b.substring(4)] = array[b]), a),
      {}
    );
    newData[key] = value;
    return newData;
  }
}

module.exports = {
  /**
   * Retrieve a single file from a Cisco UC product via DIME.
   * @param {string} host - Hostname or IP
   * @param {string} username - AXL username
   * @param {string} password - AXL password
   * @param {string} file - Full file path on server
   * @param {object} [options] - Optional config: { timeout, retries, retryDelay, onProgress }
   * @returns {Promise<{data: Buffer, filename: string, server: string}>}
   */
  getOneFile: function (host, username, password, file, options) {
    return new Promise((resolve, reject) => {
      var config = options || {};
      var onProgress = config.onProgress || null;
      let dimeFunction = dimeFileService.get(username, password, config);
      dimeFunction.getOneFile(host, file, function (err, response) {
        if (err) {
          return reject(err instanceof errors.DimeError ? err : new errors.DimeError("Error: " + err, { host: host }));
        }
        if (response) {
          var body = response.data;
          var boundary = multipart.getBoundary(response.header, '"');
          var parts = multipart.Parse(body, boundary);

          for (var i = 0; i < parts.length; i++) {
            var part = parts[i];

            var convertPart = part.data.toString("binary").trim();
            var output = Buffer.from(convertPart, "binary");

            var returnData = {
              data: output,
              filename: response.filename,
              server: host,
            };

            if (part.filetype !== "text/xml") {
              return resolve(returnData);
            }
          }
          return reject(new errors.DimeNotFoundError("No non-XML parts found in response", { host: host }));
        } else {
          return reject(new errors.DimeError("Response empty", { host: host }));
        }
      }, onProgress);
    });
  },

  /**
   * Retrieve a single file as a readable stream (avoids buffering large files in memory).
   * @param {string} host - Hostname or IP
   * @param {string} username - AXL username
   * @param {string} password - AXL password
   * @param {string} file - Full file path on server
   * @param {object} [options] - Optional config: { timeout, retries, retryDelay }
   * @returns {Promise<{header: string, filename: string, server: string, contentLength: number|null, body: ReadableStream}>}
   */
  getOneFileStream: function (host, username, password, file, options) {
    var config = options || {};
    var dimeFunction = dimeFileService.get(username, password, config);
    return dimeFunction.getOneFileStream(host, file);
  },

  /**
   * Download multiple files in parallel with concurrency control.
   * @param {string} host - Hostname or IP
   * @param {string} username - AXL username
   * @param {string} password - AXL password
   * @param {string[]} files - Array of file paths to download
   * @param {object} [options] - Optional config: { timeout, retries, retryDelay, concurrency, onProgress, onFileComplete }
   * @returns {Promise<Array<{data: Buffer, filename: string, server: string}|{error: Error, filename: string, server: string}>>}
   */
  getMultipleFiles: function (host, username, password, files, options) {
    var self = this;
    var config = options || {};
    var concurrency = config.concurrency || 5;

    return new Promise(function (resolve) {
      var results = new Array(files.length);
      var running = 0;
      var nextIndex = 0;
      var completed = 0;

      function runNext() {
        while (running < concurrency && nextIndex < files.length) {
          (function (index) {
            var file = files[index];
            running++;

            var fileOptions = Object.assign({}, config);
            if (config.onProgress) {
              fileOptions.onProgress = function (progress) {
                config.onProgress(Object.assign({ filename: file, fileIndex: index }, progress));
              };
            }

            self.getOneFile(host, username, password, file, fileOptions)
              .then(function (result) {
                results[index] = result;
                if (typeof config.onFileComplete === "function") {
                  config.onFileComplete(null, result, index);
                }
              })
              .catch(function (err) {
                results[index] = { error: err, filename: file, server: host };
                if (typeof config.onFileComplete === "function") {
                  config.onFileComplete(err, null, index);
                }
              })
              .finally(function () {
                running--;
                completed++;
                if (completed === files.length) {
                  resolve(results);
                } else {
                  runNext();
                }
              });
          })(nextIndex);
          nextIndex++;
        }
      }

      if (files.length === 0) {
        return resolve([]);
      }

      runNext();
    });
  },

  /**
   * List available service log files matching selection criteria.
   *
   * Supports both positional and named parameters:
   *   selectLogFiles(host, username, password, servicelog, fromdate, todate, timezone)
   *   selectLogFiles({ host, username, password, servicelog, fromdate, todate, timezone, timeout, retries, retryDelay })
   *
   * @param {string|object} hostOrOptions - Hostname or options object
   * @returns {Promise<Array>}
   */
  selectLogFiles: function (
    hostOrOptions,
    username,
    password,
    servicelog,
    fromdate,
    todate,
    timezone
  ) {
    var host, config;

    if (typeof hostOrOptions === "object" && hostOrOptions !== null) {
      // Named parameters
      var opts = hostOrOptions;
      host = opts.host;
      username = opts.username;
      password = opts.password;
      servicelog = opts.servicelog;
      fromdate = opts.fromdate;
      todate = opts.todate;
      timezone = opts.timezone;
      config = {
        timeout: opts.timeout,
        retries: opts.retries,
        retryDelay: opts.retryDelay,
      };
    } else {
      host = hostOrOptions;
      config = {};
    }

    return new Promise(function (resolve, reject) {
      let dimeFunction = dimeFileService.select(username, password, config);

      dimeFunction.selectLogFiles(
        host,
        servicelog,
        fromdate,
        todate,
        timezone,
        async function (err, response) {
          if (err) {
            return reject(err instanceof errors.DimeError ? err : new errors.DimeError(String(err), { host: host }));
          }
          if (response) {
            var body = response.data;
            if (response.header.includes("multipart")) {
              var boundary = multipart.getBoundary(response.header, "=");
              var parts = multipart.Parse(body, boundary);

              for (let i = 0; i < parts.length; i++) {
                var part = parts[i];
                let xmlPart = part.data.toString("binary").trim();
                let output = await parseXml(xmlPart);
                if (keyExists(output, "ns1:SetOfFiles")) {
                  var returnResults =
                    output["soapenv:Body"]["ns1:selectLogFilesResponse"][
                      "ns1:ResultSet"
                    ]["ns1:SchemaFileSelectionResult"]["ns1:Node"][
                      "ns1:ServiceList"
                    ]["ns1:ServiceLogs"]["ns1:SetOfFiles"]["ns1:File"];

                  return resolve(sanitizeOutput(returnResults, "server", host));
                } else {
                  return reject(new errors.DimeNotFoundError("No files found on server", { host: host }));
                }
              }
            } else {
              let xmlPart = body.toString("binary").trim();
              let output = await parseXml(xmlPart);
              if (keyExists(output, "ns1:SetOfFiles")) {
                let returnResults =
                  output["soapenv:Body"]["ns1:selectLogFilesResponse"][
                    "ns1:ResultSet"
                  ]["ns1:SchemaFileSelectionResult"]["ns1:Node"][
                    "ns1:ServiceList"
                  ]["ns1:ServiceLogs"]["ns1:SetOfFiles"]["ns1:File"];
                return resolve(sanitizeOutput(returnResults, "server", host));
              } else {
                return reject(new errors.DimeNotFoundError("No files found on server", { host: host }));
              }
            }
          } else {
            return reject(new errors.DimeError("Response empty", { host: host }));
          }
        }
      );
    });
  },

  /**
   * Select log files across multiple hosts and merge results.
   * @param {string[]} hosts - Array of hostnames
   * @param {string} username - AXL username
   * @param {string} password - AXL password
   * @param {string} servicelog - Service log name
   * @param {string} fromdate - Start date
   * @param {string} todate - End date
   * @param {string} timezone - Timezone string
   * @param {object} [options] - Optional config: { timeout, retries, retryDelay, concurrency }
   * @returns {Promise<Array>} Merged and flattened results from all hosts
   */
  selectLogFilesMulti: function (hosts, username, password, servicelog, fromdate, todate, timezone, options) {
    var self = this;
    var config = options || {};
    var concurrency = config.concurrency || 5;

    return new Promise(function (resolve) {
      var results = new Array(hosts.length);
      var running = 0;
      var nextIndex = 0;
      var completed = 0;

      function runNext() {
        while (running < concurrency && nextIndex < hosts.length) {
          (function (index) {
            var host = hosts[index];
            running++;

            self.selectLogFiles(host, username, password, servicelog, fromdate, todate, timezone)
              .then(function (result) {
                results[index] = Array.isArray(result) ? result : [result];
              })
              .catch(function () {
                results[index] = [];
              })
              .finally(function () {
                running--;
                completed++;
                if (completed === hosts.length) {
                  // Flatten all results into a single array
                  var merged = [];
                  for (var i = 0; i < results.length; i++) {
                    for (var j = 0; j < results[i].length; j++) {
                      merged.push(results[i][j]);
                    }
                  }
                  resolve(merged);
                } else {
                  runNext();
                }
              });
          })(nextIndex);
          nextIndex++;
        }
      }

      if (hosts.length === 0) {
        return resolve([]);
      }

      runNext();
    });
  },

  /**
   * List node names and associated service names in the cluster.
   * @param {string} host - Hostname or IP
   * @param {string} username - AXL username
   * @param {string} password - AXL password
   * @param {object} [options] - Optional config: { timeout, retries, retryDelay }
   * @returns {Promise<Array|object>}
   */
  listNodeServiceLogs: function (host, username, password, options) {
    var config = options || {};
    return new Promise(function (resolve, reject) {
      let dimeFunction = dimeFileService.list(username, password, config);

      dimeFunction.listNodeServiceLogs(host, async function (err, response) {
        if (err) {
          return reject(err instanceof errors.DimeError ? err : new errors.DimeError(String(err), { host: host }));
        }
        if (response) {
          var body = response.data;
          if (response.header.includes("multipart")) {
            var boundary = multipart.getBoundary(response.header, "=");
            var parts = multipart.Parse(body, boundary);

            for (let i = 0; i < parts.length; i++) {
              let part = parts[i];
              let xmlPart = part.data.toString("binary").trim();
              let output = await parseXml(xmlPart);
              var servicelogs;
              var returnResults;
              var serverName;

              // Was an array returned?
              if (
                Array.isArray(
                  output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
                    "ns1:listNodeServiceLogsReturn"
                  ]
                )
              ) {
                returnResults = [];
                for (
                  let j = 0;
                  j <
                  output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
                    "ns1:listNodeServiceLogsReturn"
                  ].length;
                  j++
                ) {
                  serverName =
                    output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
                      "ns1:listNodeServiceLogsReturn"
                    ][j]["ns1:name"];
                  var serviceLog =
                    output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
                      "ns1:listNodeServiceLogsReturn"
                    ][j]["ns1:ServiceLog"];
                  servicelogs = serviceLog ? serviceLog["ns1:item"] || [] : [];
                  if (!Array.isArray(servicelogs)) servicelogs = [servicelogs];
                  let jsonData = {
                    server: serverName,
                    servicelogs: servicelogs,
                    count: servicelogs.length,
                  };
                  returnResults.push(jsonData);
                }
              } else {
                var singleServiceLog =
                  output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
                    "ns1:listNodeServiceLogsReturn"
                  ]["ns1:ServiceLog"];
                servicelogs = singleServiceLog ? singleServiceLog["ns1:item"] || [] : [];
                if (!Array.isArray(servicelogs)) servicelogs = [servicelogs];
                serverName =
                  output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
                    "ns1:listNodeServiceLogsReturn"
                  ]["ns1:name"];
                returnResults = {
                  server: serverName,
                  servicelogs: servicelogs,
                  count: servicelogs.length,
                };
              }
              return resolve(returnResults);
            }
          } else {
            return reject(new errors.DimeError("Error with response", { host: host }));
          }
        } else {
          return reject(new errors.DimeError("Response empty", { host: host }));
        }
      });
    });
  },

  // Expose cookie management for consumers
  getCookie: dimeFileService.getCookie,
  setCookie: dimeFileService.setCookie,

  // Expose error types for instanceof checks
  DimeError: errors.DimeError,
  DimeAuthError: errors.DimeAuthError,
  DimeNotFoundError: errors.DimeNotFoundError,
  DimeTimeoutError: errors.DimeTimeoutError,
  DimeRateLimitError: errors.DimeRateLimitError,
};
