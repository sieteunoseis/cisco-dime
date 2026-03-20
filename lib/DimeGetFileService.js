/*jshint esversion: 11 */
var debug = require("debug")("cisco-dime");
var errors = require("./errors");

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
 * Cookie jar — stores session cookies per host+service to avoid re-authenticating.
 * Keyed by "host|serviceUrl" because CUCM's DimeGetFileService and
 * LogCollectionPortTypeService use separate sessions. A cookie from one
 * service causes HTTP 500 on the other.
 */
var _cookieJar = {};

function _cookieKey(host, serviceUrl) {
  return serviceUrl ? host + "|" + serviceUrl : host;
}

function getCookie(host, serviceUrl) {
  return _cookieJar[_cookieKey(host, serviceUrl)] || null;
}

function setCookie(host, cookie, serviceUrl) {
  _cookieJar[_cookieKey(host, serviceUrl)] = cookie;
}

/**
 * Capture Set-Cookie headers from a response and store them.
 */
function captureCookies(host, response, serviceUrl) {
  var setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    debug("captured cookie for %s (%s)", host, serviceUrl || "default");
    setCookie(host, setCookieHeader, serviceUrl);
  }
}

/**
 * Build a fresh options object for each request (avoids shared mutable state).
 */
function buildOptions(soapAction, authHeader, host, soapBody, serviceUrl) {
  var headers = {
    SOAPAction: soapAction,
    Authorization: authHeader,
    "Content-Type": "text/xml;charset=UTF-8",
  };

  var cookie = getCookie(host, serviceUrl);
  if (cookie) {
    headers["Cookie"] = cookie;
    debug("using cached cookie for %s (%s)", host, serviceUrl || "default");
  }

  return {
    method: "POST",
    headers: headers,
    body: soapBody,
  };
}

/**
 * Classify HTTP status codes into typed errors.
 */
function classifyHttpError(status, statusText, host) {
  if (status === 401 || status === 403) {
    return new errors.DimeAuthError(
      "Authentication failed: HTTP " + status + " " + statusText,
      { host: host, statusCode: status }
    );
  }
  if (status === 429 || status === 503) {
    return new errors.DimeRateLimitError(
      "Rate limited: HTTP " + status + " " + statusText,
      { host: host, statusCode: status }
    );
  }
  return new errors.DimeError(
    "HTTP " + status + ": " + statusText,
    { host: host, statusCode: status }
  );
}

/**
 * Fetch with timeout, retry, and exponential backoff.
 */
async function fetchWithRetry(url, options, config, host) {
  config = config || {};
  var timeout = config.timeout || DEFAULT_CONFIG.timeout;
  var retries = config.retries != null ? config.retries : DEFAULT_CONFIG.retries;
  var retryDelay = config.retryDelay || DEFAULT_CONFIG.retryDelay;

  var lastError;

  for (var attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      debug("retry attempt %d/%d for %s", attempt, retries, url);
    }

    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, timeout);

    var fetchOptions = Object.assign({}, options, { signal: controller.signal });

    try {
      debug("fetch %s (attempt %d)", url, attempt + 1);
      var response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Check for auth errors — don't retry these
        if (response.status === 401 || response.status === 403) {
          throw classifyHttpError(response.status, response.statusText, host);
        }

        // Check for rate limiting (HTTP 429 or 503)
        if (
          (response.status === 429 || response.status === 503) &&
          attempt < retries
        ) {
          var delay = retryDelay * Math.pow(2, attempt);
          debug("rate limited, backing off %dms", delay);
          await sleep(delay);
          continue;
        }
        throw classifyHttpError(response.status, response.statusText, host);
      }

      debug("fetch %s succeeded (%d)", url, response.status);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // If it's already a DimeError, preserve it
      if (error instanceof errors.DimeError) {
        lastError = error;
        // Don't retry auth errors
        if (error instanceof errors.DimeAuthError) {
          throw error;
        }
      } else if (error.name === "AbortError") {
        lastError = new errors.DimeTimeoutError(
          "Request timed out after " + timeout + "ms",
          { host: host }
        );
        debug("request timed out after %dms", timeout);
      } else {
        lastError = new errors.DimeError(
          error.message || String(error),
          { host: host }
        );
      }

      if (attempt < retries) {
        var backoff = retryDelay * Math.pow(2, attempt);
        debug("error: %s, backing off %dms", lastError.message, backoff);
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

    var serviceUrl = "logcollectionservice/DimeGetFileService";
    var url = "https://" + host + ":8443/logcollectionservice/services/DimeGetFileService";
    var options = buildOptions(
      "http://schemas.cisco.com/ast/soap/action/#LogCollectionPort#GetOneFile",
      this._authHeader,
      host,
      soapBody,
      serviceUrl
    );

    debug("getOneFile %s from %s", file, host);

    try {
      var response = await fetchWithRetry(url, options, this._config, host);

      captureCookies(host, response, serviceUrl);

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

      debug("getOneFile %s complete (%d bytes)", file, totalBytes);

      var buffer = Buffer.concat(data);
      payload.data = buffer;
      callback(null, payload);
    } catch (error) {
      debug("getOneFile %s failed: %s", file, error.message);
      callback(error, null);
    }
  }

  async getOneFileStream(host, file) {
    var safeFile = escapeXml(file);
    var XML = XML_ENVELOPE.replace("%FILE%", safeFile);
    var soapBody = Buffer.from(XML);

    var serviceUrl = "logcollectionservice/DimeGetFileService";
    var url = "https://" + host + ":8443/logcollectionservice/services/DimeGetFileService";
    var options = buildOptions(
      "http://schemas.cisco.com/ast/soap/action/#LogCollectionPort#GetOneFile",
      this._authHeader,
      host,
      soapBody,
      serviceUrl
    );

    debug("getOneFileStream %s from %s", file, host);

    var response = await fetchWithRetry(url, options, this._config, host);

    captureCookies(host, response, serviceUrl);

    var contentLength = parseInt(response.headers.get("content-length"), 10) || 0;

    return {
      header: response.headers.get("content-type"),
      filename: file,
      server: host,
      contentLength: contentLength || null,
      body: response.body,
    };
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

    var serviceUrl = "logcollectionservice2/LogCollectionPortTypeService";
    var url = "https://" + host + ":8443/logcollectionservice2/services/LogCollectionPortTypeService";
    var options = buildOptions(
      "selectLogFiles",
      this._authHeader,
      host,
      soapBody,
      serviceUrl
    );

    debug("selectLogFiles '%s' on %s (%s to %s)", servicelog, host, fromdate, todate);

    try {
      var response = await fetchWithRetry(url, options, this._config, host);

      captureCookies(host, response, serviceUrl);

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
      debug("selectLogFiles on %s complete (%d bytes)", host, buffer.length);
      callback(null, payload);
    } catch (error) {
      debug("selectLogFiles on %s failed: %s", host, error.message);
      callback(error, null);
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

    var serviceUrl = "logcollectionservice2/LogCollectionPortTypeService";
    var url = "https://" + host + ":8443/logcollectionservice2/services/LogCollectionPortTypeService";
    var options = buildOptions(
      "listNodeServiceLogs",
      this._authHeader,
      host,
      soapBody,
      serviceUrl
    );

    debug("listNodeServiceLogs on %s", host);

    try {
      var response = await fetchWithRetry(url, options, this._config, host);

      captureCookies(host, response, serviceUrl);

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
      debug("listNodeServiceLogs on %s complete (%d bytes)", host, buffer.length);
      callback(null, payload);
    } catch (error) {
      debug("listNodeServiceLogs on %s failed: %s", host, error.message);
      callback(error, null);
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
