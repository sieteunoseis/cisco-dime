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

function sanitizeArray(array, key, value) {
  const newData = array.map((o) =>
    Object.keys(o).reduce((a, b) => ((a[b.substring(4)] = o[b]), a), {})
  );
  newData.map((o) => (o[key] = value));
  return newData;
}

module.exports = {
  getOneFile: function (host, username, password, file) {
    return new Promise((resolve, reject) => {
      // Let's get our DIME set up service
      let dimeFunction = dimeFileService.get(username, password);
      dimeFunction.getOneFile(host, file, function (err, response) {
        if (err) {
          reject("Error: " + err);
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
              server: host
            };

            if (part.filetype !== "text/xml") {
              resolve(returnData);
            }
          }
        } else {
          reject("Response empty");
        }
      });
    });
  },
  selectLogFiles: function (
    host,
    username,
    password,
    servicelog,
    todate,
    fromdate,
    timezone
  ) {
    return new Promise(function (resolve, reject) {
      // Let's get our DIME set up service
      let dimeFunction = dimeFileService.select(username, password);

      dimeFunction.selectLogFiles(
        host,
        servicelog,
        fromdate,
        todate,
        timezone,
        async function (err, response) {
          if (err) {
            reject(err);
          }
          if (response) {
            var body = response.data;
            if (response.header.includes("multipart")) {
              var boundary = multipart.getBoundary(response.header, "="); // Ex. boundary=MIMEBoundaryurn_uuid_22B4A6A78BF231B7E31664998497678
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

                  resolve(sanitizeArray(returnResults, "server", host));
                } else {
                  reject("No files found on server");
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
                resolve(sanitizeArray(returnResults, "server", host));
              } else {
                reject("No files found on server");
              }
            }
          } else {
            reject("Response empty");
          }
        }
      );
    });
  },
  listNodeServiceLogs: function (host, username, password) {
    return new Promise(function (resolve, reject) {
      // Let's get our DIME set up service
      let dimeFunction = dimeFileService.list(username, password);

      // Let's call the List Node Service Logs
      dimeFunction.listNodeServiceLogs(host, async function (err, response) {
        if (err) {
          reject(err);
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
              let servicelogs = output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"]["ns1:listNodeServiceLogsReturn"][0]["ns1:ServiceLog"]["ns1:item"]
              let returnResults = {
                count: servicelogs.length,
                servicelogs: servicelogs,
                server: host
              };

              resolve(returnResults);
            }
          } else {
            let xmlPart = body.toString("binary").trim();
            let output = await parseXml(xmlPart);
            let servicelogs = output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"]["ns1:listNodeServiceLogsReturn"][0]["ns1:ServiceLog"]["ns1:item"]
            let returnResults = {
              count: servicelogs.length,
              servicelogs: servicelogs,
              server: host
            };
            resolve(returnResults);
          }
        } else {
          reject("Response empty");
        }
      });
    });
  },
};
