/*jshint esversion: 11 */
var util = require("util");

const MODE = process.env.MODE || "DEV";

if (MODE === "DEV") {
  console.log("Running in development mode");
  console.log("Disabling warnings");
  console.log(
    "Disabling certificate validation for TLS connections. This makes TLS, and HTTPS by extension, insecure. The use of this environment variable is strongly discouraged"
  );
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // needed if you are using self-signed certificates
}

var XML_ENVELOPE =
  '<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap/"><soapenv:Header/><soapenv:Body><soap:GetOneFile soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><FileName xsi:type="get:FileName" xmlns:get="http://cisco.com/ccm/serviceability/soap/LogCollection/GetFile/">%s</FileName></soap:GetOneFile></soapenv:Body></soapenv:Envelope>';

var SELECT_XML_ENVELOPE =
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">' +
  "<soapenv:Header/>" +
  "<soapenv:Body>" +
  "<soap:selectLogFiles>" +
  "<soap:FileSelectionCriteria>" +
  "<soap:ServiceLogs>" +
  "<soap:item>%s</soap:item>" +
  "</soap:ServiceLogs>" +
  "<soap:SystemLogs>" +
  "<soap:item></soap:item>" +
  "</soap:SystemLogs>" +
  "<soap:SearchStr></soap:SearchStr>" +
  "<soap:Frequency>OnDemand</soap:Frequency>" +
  "<soap:JobType>DownloadtoClient</soap:JobType>" + // If the JobType element is set to DownloadtoClient, then the service will simply retrieve a list of matching available log files. Note: no files are actually downloaded.
  "<soap:ToDate>%s</soap:ToDate>" +
  "<soap:FromDate>%s</soap:FromDate>" +
  "<soap:TimeZone>%s</soap:TimeZone>" +
  "<soap:RelText>None</soap:RelText>" + // Note: Relative time range filtering is not currently supported - RelText and RelTime are ignored, however the elements must be present, with valid values, i.e. None and 0.
  "<soap:RelTime>0</soap:RelTime>" + // Note: Relative time range filtering is not currently supported - RelText and RelTime are ignored, however the elements must be present, with valid values, i.e. None and 0.
  "<soap:Port></soap:Port>" +
  "<soap:IPAddress></soap:IPAddress>" +
  "<soap:UserName></soap:UserName>" +
  "<soap:Password></soap:Password>" +
  "<soap:ZipInfo></soap:ZipInfo>" +
  "<soap:RemoteFolder></soap:RemoteFolder>" +
  "</soap:FileSelectionCriteria>" +
  "</soap:selectLogFiles>" +
  "</soapenv:Body>" +
  "</soapenv:Envelope>";

var LIST_XML_ENVELOPE =
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">' +
  "<soapenv:Header/>" +
  "<soapenv:Body>" +
  "<soap:listNodeServiceLogs>" +
  "<soap:ListRequest>" +
  "</soap:ListRequest>" + // The value should be left empty.
  "</soap:listNodeServiceLogs>" +
  "</soapenv:Body>" +
  "</soapenv:Envelope>";

class ucSoapGetSession {
  constructor(ucUser, ucPassword) {
    this._OPTIONS = {
      method: "POST",
      headers: {
        SOAPAction:
          "http://schemas.cisco.com/ast/soap/action/#LogCollectionPort#GetOneFile",
        Authorization:
          "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
      },
    };
  }
  async getOneFile(host, file, callback) {
    var XML = util.format(XML_ENVELOPE, file);
    var soapBody = Buffer.from(XML);
    var options = this._OPTIONS;
    options.body = soapBody;

    fetch(
      `https://${host}:8443/logcollectionservice/services/DimeGetFileService`,
      options
    )
      .then(handleError) // skips to .catch if error is thrown
      .then(async (response) => {
        var payload = {
          header: "",
          data: "",
          filename: file,
        };

        var data = []; // create an array to save chunked DIME data from server

        payload.header = response.headers.get("content-type"); // save content-type to variable. holds the boundary needed to put DIME back together

        // response.body is a ReadableStream
        const reader = response.body.getReader();
        for await (const chunk of readChunks(reader)) {
          data.push(Buffer.from(chunk));
        }

        var buffer = Buffer.concat(data); // create buffer of data
        payload.data = buffer;
        callback(null, payload); // call back buffer
      })
      .catch((error) => {
        callback(error.cause.code, null);
      }); // catches the error and logs it
  }
}

class ucSoapSelectSession {
  constructor(ucUser, ucPassword) {
    this._OPTIONS = {
      method: "POST",
      headers: {
        SOAPAction: "selectLogFiles",
        Authorization:
          "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
      },
    };
  }
  selectLogFiles(
    host,
    servicelog,
    todate,
    fromdate,
    timezone,
    callback
  ) {
    var XML = util.format(
      SELECT_XML_ENVELOPE,
      servicelog,
      todate,
      fromdate,
      timezone
    );
    var soapBody = Buffer.from(XML);
    var options = this._OPTIONS;
    options.body = soapBody;

    fetch(
      `https://${host}:8443/logcollectionservice2/services/LogCollectionPortTypeService`,
      options
    )
      .then(handleError) // skips to .catch if error is thrown
      .then(async (response) => {
        var payload = {
          header: "",
          data: "",
        };

        var data = []; // create an array to save chunked DIME data from server

        payload.header = response.headers.get("content-type"); // save content-type to variable. holds the boundary needed to put DIME back together

        // response.body is a ReadableStream
        const reader = response.body.getReader();
        for await (const chunk of readChunks(reader)) {
          data.push(Buffer.from(chunk));
        }

        var buffer = Buffer.concat(data); // create buffer of data
        payload.data = buffer;
        callback(null, payload); // call back buffer
      })
      .catch((error) => {
        console.log(error);
        callback(error, null);
      }); // catches the error and logs it
  }
}

class ucSoapListSession {
  constructor(ucUser, ucPassword) {
    this._OPTIONS = {
      method: "POST",
      headers: {
        SOAPAction: "listNodeServiceLogs",
        Authorization:
          "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64"),
        "Content-Type": "text/xml;charset=UTF-8",
      },
    };
  }
  listNodeServiceLogs(host, callback) {
    var soapBody = Buffer.from(LIST_XML_ENVELOPE);
    var options = this._OPTIONS;

    options.body = soapBody;

    fetch(
      `https://${host}:8443/logcollectionservice2/services/LogCollectionPortTypeService`,
      options
    )
      .then(handleError) // skips to .catch if error is thrown
      .then(async (response) => {
        var payload = {
          header: "",
          data: ""
        };
        var data = []; // create an array to save chunked DIME data from server
        payload.header = response.headers.get("content-type"); // save content-type to variable. holds the boundary needed to put DIME back together
        // response.body is a ReadableStream
        const reader = response.body.getReader();
        for await (const chunk of readChunks(reader)) {
          data.push(Buffer.from(chunk));
        }

        var buffer = Buffer.concat(data); // create buffer of data
        payload.data = buffer;

        callback(null, payload); // call back buffer
      })
      .catch((error) => {
        console.log(error);
        callback(error, null);
      }); // catches the error and logs it
  }
}
// Array to hold the Session ID's
var sessionIdArr = [];

const handleError = (response) => {
  if (!response.ok) {
    throw Error(response.statusText);
  } else {
    return response;
  }
}; //handler function that throws any encountered error

// readChunks() reads from the provided reader and yields the results into an async iterable
function readChunks(reader) {
  return {
    async *[Symbol.asyncIterator]() {
      let readResult = await reader.read();
      while (!readResult.done) {
        yield readResult.value;
        readResult = await reader.read();
      }
    },
  };
}

module.exports = {
  get: function (ucUser, ucPassword) {
    return new ucSoapGetSession(ucUser, ucPassword);
  },
  list: function (ucUser, ucPassword) {
    return new ucSoapListSession(ucUser, ucPassword);
  },
  select: function (ucUser, ucPassword) {
    return new ucSoapSelectSession(ucUser, ucPassword);
  },
};
