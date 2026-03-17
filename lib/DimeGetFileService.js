/*jshint esversion: 11 */

// --- XML Envelope Templates ---

var XML_ENVELOPE =
  '<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap/"><soapenv:Header/><soapenv:Body><soap:GetOneFile soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><FileName xsi:type="get:FileName" xmlns:get="http://cisco.com/ccm/serviceability/soap/LogCollection/GetFile/">%FILE%</FileName></soap:GetOneFile></soapenv:Body></soapenv:Envelope>';

var SELECT_XML_ENVELOPE =
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:soap="http://schemas.cisco.com/ast/soap">' +
  "<soapenv:Header/>" +
  "<soapenv:Body>" +
  "<soap:selectLogFiles>" +
  "<soap:FileSelectionCriteria>" +
  "<soap:ServiceLogs>" +
  "<soap:item>%SERVICELOG%</soap:item>" +
  "</soap:ServiceLogs>" +
  "<soap:SystemLogs>" +
  "<soap:item></soap:item>" +
  "</soap:SystemLogs>" +
  "<soap:SearchStr></soap:SearchStr>" +
  "<soap:Frequency>OnDemand</soap:Frequency>" +
  "<soap:JobType>DownloadtoClient</soap:JobType>" +
  "<soap:ToDate>%TODATE%</soap:ToDate>" +
  "<soap:FromDate>%FROMDATE%</soap:FromDate>" +
  "<soap:TimeZone>%TIMEZONE%</soap:TimeZone>" +
  "<soap:RelText>None</soap:RelText>" +
  "<soap:RelTime>0</soap:RelTime>" +
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
  "</soap:ListRequest>" +
  "</soap:listNodeServiceLogs>" +
  "</soapenv:Body>" +
  "</soapenv:Envelope>";

// --- Shared Utilities ---

/**
 * Escape special XML characters to prevent injection.
 */
function escapeXml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Default configuration for requests.
 */
var DEFAULT_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second base delay
};

/**
 * Cookie jar — stores session cookies per host to avoid re-authenticating.
 */
var _cookieJar = {};

function getCookie(host) {
  return _cookieJar[host] || null;
}

function setCookie(host, cookie) {
  _cookieJar[host] = cookie;
}

/**
 * Capture Set-Cookie headers from a response and store them.
 */
function captureCookies(host, response) {
  var setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    setCookie(host, setCookieHeader);
  }
}

/**
 * Build a fresh options object for each request (avoids shared mutable state).
 */
function buildOptions(soapAction, authHeader, host, soapBody) {
  var headers = {
    SOAPAction: soapAction,
    Authorization: authHeader,
    "Content-Type": "text/xml;charset=UTF-8",
  };

  var cookie = getCookie(host);
  if (cookie) {
    headers["Cookie"] = cookie;
  }

  return {
    method: "POST",
    headers: headers,
    body: soapBody,
  };
}

/**
 * Fetch with timeout, retry, and exponential backoff.
 */
async function fetchWithRetry(url, options, config) {
  config = config || {};
  var timeout = config.timeout || DEFAULT_CONFIG.timeout;
  var retries = config.retries != null ? config.retries : DEFAULT_CONFIG.retries;
  var retryDelay = config.retryDelay || DEFAULT_CONFIG.retryDelay;

  var lastError;

  for (var attempt = 0; attempt <= retries; attempt++) {
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, timeout);

    var fetchOptions = Object.assign({}, options, { signal: controller.signal });

    try {
      var response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check for rate limiting (HTTP 429 or 503)
        if (
          (response.status === 429 || response.status === 503) &&
          attempt < retries
        ) {
          var delay = retryDelay * Math.pow(2, attempt); // exponential backoff
          await sleep(delay);
          continue;
        }
        throw new Error(
          "HTTP " + response.status + ": " + response.statusText
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Don't retry on abort (timeout) unless we have retries left
      if (attempt < retries) {
        var backoff = retryDelay * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// readChunks() reads from the provided reader and yields the results into an async iterable
function readChunks(reader) {
  return {
    async *[Symbol.asyncIterator]() {
      var readResult = await reader.read();
      while (!readResult.done) {
        yield readResult.value;
        readResult = await reader.read();
      }
    },
  };
}

// --- SOAP Session Classes ---

class ucSoapGetSession {
  constructor(ucUser, ucPassword, config) {
    this._authHeader =
      "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64");
    this._config = config || {};
  }

  async getOneFile(host, file, callback, onProgress) {
    var safeFile = escapeXml(file);
    var XML = XML_ENVELOPE.replace("%FILE%", safeFile);
    var soapBody = Buffer.from(XML);

    var options = buildOptions(
      "http://schemas.cisco.com/ast/soap/action/#LogCollectionPort#GetOneFile",
      this._authHeader,
      host,
      soapBody
    );

    try {
      var response = await fetchWithRetry(
        "https://" + host + ":8443/logcollectionservice/services/DimeGetFileService",
        options,
        this._config
      );

      captureCookies(host, response);

      var payload = {
        header: "",
        data: "",
        filename: file,
      };

      var data = [];
      var totalBytes = 0;
      var contentLength = parseInt(response.headers.get("content-length"), 10) || 0;

      payload.header = response.headers.get("content-type");

      var reader = response.body.getReader();
      for await (var chunk of readChunks(reader)) {
        data.push(Buffer.from(chunk));
        totalBytes += chunk.length;
        if (typeof onProgress === "function") {
          onProgress({
            bytesRead: totalBytes,
            contentLength: contentLength || null,
            percent: contentLength ? Math.round((totalBytes / contentLength) * 100) : null,
          });
        }
      }

      var buffer = Buffer.concat(data);
      payload.data = buffer;
      callback(null, payload);
    } catch (error) {
      var code = error.cause && error.cause.code ? error.cause.code : error.message || error;
      callback(code, null);
    }
  }
}

class ucSoapSelectSession {
  constructor(ucUser, ucPassword, config) {
    this._authHeader =
      "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64");
    this._config = config || {};
  }

  async selectLogFiles(host, servicelog, fromdate, todate, timezone, callback) {
    var XML = SELECT_XML_ENVELOPE
      .replace("%SERVICELOG%", escapeXml(servicelog))
      .replace("%TODATE%", escapeXml(todate))
      .replace("%FROMDATE%", escapeXml(fromdate))
      .replace("%TIMEZONE%", escapeXml(timezone));

    var soapBody = Buffer.from(XML);

    var options = buildOptions(
      "selectLogFiles",
      this._authHeader,
      host,
      soapBody
    );

    try {
      var response = await fetchWithRetry(
        "https://" + host + ":8443/logcollectionservice2/services/LogCollectionPortTypeService",
        options,
        this._config
      );

      captureCookies(host, response);

      var payload = {
        header: "",
        data: "",
      };

      var data = [];

      payload.header = response.headers.get("content-type");

      var reader = response.body.getReader();
      for await (var chunk of readChunks(reader)) {
        data.push(Buffer.from(chunk));
      }

      var buffer = Buffer.concat(data);
      payload.data = buffer;
      callback(null, payload);
    } catch (error) {
      callback(error.message || error, null);
    }
  }
}

class ucSoapListSession {
  constructor(ucUser, ucPassword, config) {
    this._authHeader =
      "Basic " + Buffer.from(ucUser + ":" + ucPassword).toString("base64");
    this._config = config || {};
  }

  async listNodeServiceLogs(host, callback) {
    var soapBody = Buffer.from(LIST_XML_ENVELOPE);

    var options = buildOptions(
      "listNodeServiceLogs",
      this._authHeader,
      host,
      soapBody
    );

    try {
      var response = await fetchWithRetry(
        "https://" + host + ":8443/logcollectionservice2/services/LogCollectionPortTypeService",
        options,
        this._config
      );

      captureCookies(host, response);

      var payload = {
        header: "",
        data: "",
      };

      var data = [];
      payload.header = response.headers.get("content-type");

      var reader = response.body.getReader();
      for await (var chunk of readChunks(reader)) {
        data.push(Buffer.from(chunk));
      }

      var buffer = Buffer.concat(data);
      payload.data = buffer;
      callback(null, payload);
    } catch (error) {
      callback(error.message || error, null);
    }
  }
}

module.exports = {
  get: function (ucUser, ucPassword, config) {
    return new ucSoapGetSession(ucUser, ucPassword, config);
  },
  list: function (ucUser, ucPassword, config) {
    return new ucSoapListSession(ucUser, ucPassword, config);
  },
  select: function (ucUser, ucPassword, config) {
    return new ucSoapSelectSession(ucUser, ucPassword, config);
  },
  getCookie: getCookie,
  setCookie: setCookie,
};
