/*jshint esversion: 11 */
var dimeFileService = require("./lib/DimeGetFileService");
var multipart = require("./lib/multipart");
var parseString = require("xml2js").parseString;

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
          return reject("Error: " + err);
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
          reject("No non-XML parts found in response");
        } else {
          reject("Response empty");
        }
      }, onProgress);
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
            return reject(err);
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
                  return reject("No files found on server");
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
                return reject("No files found on server");
              }
            }
          } else {
            return reject("Response empty");
          }
        }
      );
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
          return reject(err);
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
            return reject("Error with response");
          }
        } else {
          return reject("Response empty");
        }
      });
    });
  },
  // Expose cookie management for consumers
  getCookie: dimeFileService.getCookie,
  setCookie: dimeFileService.setCookie,
};
