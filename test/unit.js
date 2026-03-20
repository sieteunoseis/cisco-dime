/*jshint esversion: 11 */
/**
 * Unit tests with mocked SOAP responses.
 * These run without a live CUCM and are safe for CI.
 *
 * Usage: node test/unit.js
 */

var http = require("http");
var assert = require("assert");
var ciscoDime = require("../main");
var multipart = require("../lib/multipart");
var errors = require("../lib/errors");

var passed = 0;
var failed = 0;
var total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log("  PASS: " + name);
  } catch (err) {
    failed++;
    console.log("  FAIL: " + name);
    console.log("        " + err.message);
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log("  PASS: " + name);
  } catch (err) {
    failed++;
    console.log("  FAIL: " + name);
    console.log("        " + err.message);
  }
}

// --- Mock SOAP Responses ---

var LIST_RESPONSE_SINGLE_NODE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
  "<soapenv:Body>" +
  "<ns1:listNodeServiceLogsResponse>" +
  "<ns1:listNodeServiceLogsReturn>" +
  "<ns1:name>cucm-pub.example.com</ns1:name>" +
  "<ns1:ServiceLog>" +
  "<ns1:item>Cisco CallManager</ns1:item>" +
  "<ns1:item>Cisco Tftp</ns1:item>" +
  "</ns1:ServiceLog>" +
  "</ns1:listNodeServiceLogsReturn>" +
  "</ns1:listNodeServiceLogsResponse>" +
  "</soapenv:Body>" +
  "</soapenv:Envelope>";

var LIST_RESPONSE_MULTI_NODE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
  "<soapenv:Body>" +
  "<ns1:listNodeServiceLogsResponse>" +
  "<ns1:listNodeServiceLogsReturn>" +
  "<ns1:name>cucm-pub.example.com</ns1:name>" +
  "<ns1:ServiceLog>" +
  "<ns1:item>Cisco CallManager</ns1:item>" +
  "</ns1:ServiceLog>" +
  "</ns1:listNodeServiceLogsReturn>" +
  "<ns1:listNodeServiceLogsReturn>" +
  "<ns1:name>cucm-sub.example.com</ns1:name>" +
  "<ns1:ServiceLog>" +
  "<ns1:item>Cisco CallManager</ns1:item>" +
  "<ns1:item>Cisco CTIManager</ns1:item>" +
  "</ns1:ServiceLog>" +
  "</ns1:listNodeServiceLogsReturn>" +
  "</ns1:listNodeServiceLogsResponse>" +
  "</soapenv:Body>" +
  "</soapenv:Envelope>";

var SELECT_RESPONSE =
  '<?xml version="1.0" encoding="UTF-8"?>' +
  '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
  "<soapenv:Body>" +
  "<ns1:selectLogFilesResponse>" +
  "<ns1:ResultSet>" +
  "<ns1:SchemaFileSelectionResult>" +
  "<ns1:Node>" +
  "<ns1:ServiceList>" +
  "<ns1:ServiceLogs>" +
  "<ns1:SetOfFiles>" +
  "<ns1:File>" +
  "<ns1:name>SDL001_100_001.txt.gz</ns1:name>" +
  "<ns1:absolutepath>/var/log/active/cm/trace/ccm/sdl/SDL001_100_001.txt.gz</ns1:absolutepath>" +
  "<ns1:filesize>1024</ns1:filesize>" +
  "<ns1:modifiedDate>Mon Mar 17 10:00:00 PDT 2026</ns1:modifiedDate>" +
  "</ns1:File>" +
  "</ns1:SetOfFiles>" +
  "</ns1:ServiceLogs>" +
  "</ns1:ServiceList>" +
  "</ns1:Node>" +
  "</ns1:SchemaFileSelectionResult>" +
  "</ns1:ResultSet>" +
  "</ns1:selectLogFilesResponse>" +
  "</soapenv:Body>" +
  "</soapenv:Envelope>";

/**
 * Create a multipart SOAP response body with proper boundaries.
 */
function wrapInMultipart(xmlBody, boundary) {
  var body = "\r\n";
  body += "--" + boundary + "\r\n";
  body += "Content-Type: text/xml; charset=UTF-8\r\n";
  body += "Content-Transfer-Encoding: binary\r\n";
  body += "\r\n";
  body += xmlBody + "\r\n";
  body += "--" + boundary + "\r\n";
  return Buffer.from(body, "utf-8");
}

/**
 * Start a mock HTTP server that returns canned SOAP responses.
 */
function createMockServer(responseMap) {
  var server = http.createServer(function (req, res) {
    var bodyParts = [];
    req.on("data", function (chunk) {
      bodyParts.push(chunk);
    });
    req.on("end", function () {
      var soapAction = req.headers.soapaction || "";
      var handler = responseMap[soapAction] || responseMap["*"];

      if (!handler) {
        res.writeHead(500);
        res.end("No handler for SOAPAction: " + soapAction);
        return;
      }

      handler(req, res, Buffer.concat(bodyParts).toString());
    });
  });

  return server;
}

// ================================
// Test Suites
// ================================

async function runTests() {
  console.log("\n--- Multipart Parser Tests ---\n");

  test("getBoundary extracts boundary from = splitter", function () {
    var header = 'multipart/related; type="text/xml"; boundary=MIMEBoundary123';
    var result = multipart.getBoundary(header, "=");
    assert.strictEqual(result, "MIMEBoundary123");
  });

  test("getBoundary extracts boundary from \" splitter", function () {
    var header = 'multipart/related; boundary="----=_Part_366_123.456"';
    var result = multipart.getBoundary(header, '"');
    assert.strictEqual(result, "----=_Part_366_123.456");
  });

  test("getBoundary returns empty string for missing boundary", function () {
    var result = multipart.getBoundary("text/xml; charset=UTF-8", "=");
    assert.strictEqual(result, "");
  });

  test("getBoundary handles null header", function () {
    var result = multipart.getBoundary(null, "=");
    assert.strictEqual(result, "");
  });

  test("Parse returns correct number of parts from DemoData", function () {
    var body = multipart.DemoData();
    var parts = multipart.Parse(body, "----WebKitFormBoundaryvef1fLxmoUdYZWXp");
    assert.strictEqual(parts.length, 2);
  });

  // --- Error Type Tests ---

  console.log("\n--- Error Type Tests ---\n");

  test("DimeError has correct name and properties", function () {
    var err = new errors.DimeError("test error", { host: "1.2.3.4", statusCode: 500 });
    assert.strictEqual(err.name, "DimeError");
    assert.strictEqual(err.message, "test error");
    assert.strictEqual(err.host, "1.2.3.4");
    assert.strictEqual(err.statusCode, 500);
    assert.ok(err instanceof Error);
  });

  test("DimeAuthError extends DimeError", function () {
    var err = new errors.DimeAuthError("auth failed", { host: "1.2.3.4", statusCode: 401 });
    assert.strictEqual(err.name, "DimeAuthError");
    assert.ok(err instanceof errors.DimeError);
    assert.ok(err instanceof Error);
  });

  test("DimeTimeoutError extends DimeError", function () {
    var err = new errors.DimeTimeoutError("timed out", { host: "1.2.3.4" });
    assert.strictEqual(err.name, "DimeTimeoutError");
    assert.ok(err instanceof errors.DimeError);
  });

  test("DimeRateLimitError extends DimeError", function () {
    var err = new errors.DimeRateLimitError("rate limited", { host: "1.2.3.4", statusCode: 429 });
    assert.strictEqual(err.name, "DimeRateLimitError");
    assert.ok(err instanceof errors.DimeError);
  });

  test("DimeNotFoundError extends DimeError", function () {
    var err = new errors.DimeNotFoundError("not found", { host: "1.2.3.4" });
    assert.strictEqual(err.name, "DimeNotFoundError");
    assert.ok(err instanceof errors.DimeError);
  });

  test("Error types are exported from main module", function () {
    assert.strictEqual(ciscoDime.DimeError, errors.DimeError);
    assert.strictEqual(ciscoDime.DimeAuthError, errors.DimeAuthError);
    assert.strictEqual(ciscoDime.DimeNotFoundError, errors.DimeNotFoundError);
    assert.strictEqual(ciscoDime.DimeTimeoutError, errors.DimeTimeoutError);
    assert.strictEqual(ciscoDime.DimeRateLimitError, errors.DimeRateLimitError);
  });

  // --- Cookie Management Tests ---

  console.log("\n--- Cookie Management Tests ---\n");

  test("getCookie returns null for unknown host", function () {
    assert.strictEqual(ciscoDime.getCookie("unknown-host.example.com"), null);
  });

  test("setCookie and getCookie round-trip", function () {
    ciscoDime.setCookie("test-host.example.com", "JSESSIONID=abc123");
    assert.strictEqual(ciscoDime.getCookie("test-host.example.com"), "JSESSIONID=abc123");
  });

  // --- Mock Server Integration Tests ---

  console.log("\n--- Mock Server Integration Tests ---\n");

  var boundary = "MIMEBoundaryTestBoundary123";

  var mockServer = createMockServer({
    "listNodeServiceLogs": function (req, res) {
      var body = wrapInMultipart(LIST_RESPONSE_SINGLE_NODE, boundary);
      res.writeHead(200, {
        "Content-Type": 'multipart/related; type="text/xml"; boundary=' + boundary,
      });
      res.end(body);
    },
    "selectLogFiles": function (req, res, reqBody) {
      if (reqBody.includes("NonExistentService")) {
        var emptyResponse =
          '<?xml version="1.0" encoding="UTF-8"?>' +
          '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
          "<soapenv:Body>" +
          "<ns1:selectLogFilesResponse>" +
          "<ns1:ResultSet>" +
          "<ns1:SchemaFileSelectionResult>" +
          "<ns1:Node><ns1:ServiceList><ns1:ServiceLogs></ns1:ServiceLogs></ns1:ServiceList></ns1:Node>" +
          "</ns1:SchemaFileSelectionResult>" +
          "</ns1:ResultSet>" +
          "</ns1:selectLogFilesResponse>" +
          "</soapenv:Body>" +
          "</soapenv:Envelope>";
        var emptyBody = wrapInMultipart(emptyResponse, boundary);
        res.writeHead(200, {
          "Content-Type": 'multipart/related; type="text/xml"; boundary=' + boundary,
        });
        res.end(emptyBody);
      } else {
        var selectBody = wrapInMultipart(SELECT_RESPONSE, boundary);
        res.writeHead(200, {
          "Content-Type": 'multipart/related; type="text/xml"; boundary=' + boundary,
        });
        res.end(selectBody);
      }
    },
    "*": function (req, res) {
      res.writeHead(401);
      res.end("Unauthorized");
    },
  });

  await new Promise(function (resolve) {
    mockServer.listen(0, "127.0.0.1", resolve);
  });

  var port = mockServer.address().port;
  var mockHost = "127.0.0.1:" + port;

  // Override the port in the service URLs by patching fetch temporarily
  var originalFetch = global.fetch;
  global.fetch = function (url, options) {
    // Redirect CUCM SOAP calls to our mock server
    var newUrl = url.replace(/https:\/\/[^/]+:\d+/, "http://127.0.0.1:" + port);
    return originalFetch(newUrl, options);
  };

  await testAsync("listNodeServiceLogs returns single node data as array", async function () {
    var result = await ciscoDime.listNodeServiceLogs(mockHost, "admin", "admin", { retries: 0, timeout: 5000 });
    assert.ok(Array.isArray(result), "should always return an array");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].server, "cucm-pub.example.com");
    assert.ok(Array.isArray(result[0].servicelogs));
    assert.strictEqual(result[0].count, 2);
    assert.strictEqual(result[0].servicelogs[0], "Cisco CallManager");
    assert.strictEqual(result[0].servicelogs[1], "Cisco Tftp");
  });

  await testAsync("selectLogFiles returns file list as array", async function () {
    var result = await ciscoDime.selectLogFiles(
      mockHost, "admin", "admin",
      "Cisco CallManager",
      "03/17/26 10:00 AM",
      "03/17/26 11:00 AM",
      "Client: (GMT-8:0)America/Los_Angeles"
    );
    assert.ok(Array.isArray(result), "should always return an array");
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "SDL001_100_001.txt.gz");
    assert.strictEqual(result[0].filesize, "1024");
    assert.strictEqual(result[0].server, mockHost);
  });

  await testAsync("selectLogFiles with named parameters works", async function () {
    var result = await ciscoDime.selectLogFiles({
      host: mockHost,
      username: "admin",
      password: "admin",
      servicelog: "Cisco CallManager",
      fromdate: "03/17/26 10:00 AM",
      todate: "03/17/26 11:00 AM",
      timezone: "Client: (GMT-8:0)America/Los_Angeles",
      retries: 0,
      timeout: 5000,
    });
    assert.ok(Array.isArray(result) || typeof result === "object");
  });

  await testAsync("selectLogFiles rejects with DimeNotFoundError for no files", async function () {
    try {
      await ciscoDime.selectLogFiles(
        mockHost, "admin", "admin",
        "NonExistentService",
        "03/17/26 10:00 AM",
        "03/17/26 11:00 AM",
        "Client: (GMT-8:0)America/Los_Angeles"
      );
      assert.fail("Should have thrown");
    } catch (err) {
      assert.ok(err instanceof errors.DimeNotFoundError, "Expected DimeNotFoundError but got: " + err.name);
    }
  });

  await testAsync("selectLogFilesMulti merges results from multiple hosts", async function () {
    var result = await ciscoDime.selectLogFilesMulti(
      [mockHost, mockHost],
      "admin", "admin",
      "Cisco CallManager",
      "03/17/26 10:00 AM",
      "03/17/26 11:00 AM",
      "Client: (GMT-8:0)America/Los_Angeles"
    );
    assert.ok(Array.isArray(result));
    // Two hosts, each returning one file = 2 results
    assert.strictEqual(result.length, 2);
  });

  await testAsync("getMultipleFiles returns empty array for empty input", async function () {
    var result = await ciscoDime.getMultipleFiles(mockHost, "admin", "admin", []);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 0);
  });

  // Restore original fetch and close server
  global.fetch = originalFetch;
  await new Promise(function (resolve) {
    mockServer.close(resolve);
  });

  // --- Summary ---
  console.log("\n================================");
  console.log("  Results: " + passed + "/" + total + " passed" + (failed > 0 ? ", " + failed + " failed" : ""));
  console.log("================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(function (err) {
  console.error("Test runner error:", err);
  process.exit(1);
});
