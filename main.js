/*jshint esversion: 8 */
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
          resolve(
            result
          );
        }
      }
    );
  });
}

module.exports = {
  getOneFile: function (host, username, password, file) {
    let dimeFunction = dimeFileService.get(username, password);

    return new Promise((resolve, reject) => {
      dimeFunction.getOneFileResponse(host, file, function (err, response) {
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
  selectFiles: function (
    host,
    username,
    password,
    servicelog,
    todate,
    fromdate,
    timezone
  ) {
    return new Promise(function (resolve, reject) {
      // Do async job
      let dimeFunction = dimeFileService.select(username, password);

      dimeFunction.selectLogFilesResponse(
        host,
        servicelog,
        todate,
        fromdate,
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
				resolve(output["soapenv:Body"]["ns1:selectLogFilesResponse"][
					"ns1:ResultSet"
				  ]["ns1:SchemaFileSelectionResult"]["ns1:Node"]["ns1:ServiceList"][
					"ns1:ServiceLogs"
				  ]["ns1:SetOfFiles"]["ns1:File"]);
              }
            } else {
              let xmlPart = body.toString("binary").trim();
			  let output = await parseXml(xmlPart);
			  resolve(output["soapenv:Body"]["ns1:selectLogFilesResponse"][
				  "ns1:ResultSet"
				]["ns1:SchemaFileSelectionResult"]["ns1:Node"]["ns1:ServiceList"][
				  "ns1:ServiceLogs"
				]["ns1:SetOfFiles"]["ns1:File"]);
            }
          } else {
            reject("Response empty");
          }
        }
      );

      process.on("uncaughtException", function (err) {
        reject(err);
      });
    });
  },
  listFiles: function (host, username, password) {
    return new Promise(function (resolve, reject) {
      // Do async job
      let dimeFunction = dimeFileService.list(username, password);

      dimeFunction.listNodeServiceLogsResponse(host,async function (err, response) {
        if (err) {
          reject(err);
        }
        if (response) {
          var body = response.data;
          if (response.header.includes("multipart")) {
            var boundary = multipart.getBoundary(
              response.header,
              "="
            );
            var parts = multipart.Parse(body, boundary);

            for (let i = 0; i < parts.length; i++) {
              let part = parts[i];
              let xmlPart = part.data.toString("binary").trim();
			  let output = await parseXml(xmlPart);
			  resolve(output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
				"ns1:listNodeServiceLogsReturn"
			  ][0]["ns1:ServiceLog"]["ns1:item"]);
            }
          } else {
            let xmlPart = body.toString("binary").trim();
			let output = await parseXml(xmlPart);
			resolve(output["soapenv:Body"]["ns1:listNodeServiceLogsResponse"][
			  "ns1:listNodeServiceLogsReturn"
			][0]["ns1:ServiceLog"]["ns1:item"]);
          }
        } else {
          reject("Response empty");
        }
      });

      process.on("uncaughtException", function (err) {
        reject(err);
      });
    });
  },
};
