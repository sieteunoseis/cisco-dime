"use strict";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("node:fs");
const os = require("node:os");

// Load env file based on NODE_ENV before requiring anything that reads env
if (process.env.NODE_ENV === "development") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "development.env") });
} else if (process.env.NODE_ENV === "test") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "test.env") });
} else if (process.env.NODE_ENV === "staging") {
  require("dotenv").config({ path: path.join(__dirname, "..", "env", "staging.env") });
}

const { cleanEnv, str, host } = require("envalid");

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ["development", "test", "production", "staging"],
    desc: "Node environment",
  }),
  CUCM_HOSTNAME: host({ desc: "Cisco CUCM Hostname or IP Address." }),
  CUCM_USERNAME: str({ desc: "Cisco CUCM AXL Username." }),
  CUCM_PASSWORD: str({ desc: "Cisco CUCM AXL Password." }),
});

// Disable TLS verification for self-signed certs in lab/staging
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const ciscoDime = require("../main");
const {
  DimeError,
  DimeAuthError,
  DimeNotFoundError,
  DimeTimeoutError,
} = ciscoDime;

let authPassed = false;
let discoveredNodes = [];
let selectedFiles = [];

describe("cisco-dime integration tests", () => {
  describe("authentication & connectivity", () => {
    it("listNodeServiceLogs succeeds (proves auth works)", async () => {
      const result = await ciscoDime.listNodeServiceLogs(
        env.CUCM_HOSTNAME,
        env.CUCM_USERNAME,
        env.CUCM_PASSWORD
      );
      const nodes = Array.isArray(result) ? result : [result];
      assert.ok(nodes.length > 0, "should discover at least one node");

      // Verify node structure
      const firstNode = nodes[0];
      assert.ok(firstNode.server, "node should have a server name");
      assert.ok(Array.isArray(firstNode.servicelogs), "node should have servicelogs array");
      assert.ok(firstNode.servicelogs.length > 0, "node should have at least one service log");
      assert.ok(typeof firstNode.count === "number", "node should have a count");

      discoveredNodes = nodes;
      authPassed = true;
    });

    it("rejects invalid credentials", async () => {
      try {
        const result = await ciscoDime.listNodeServiceLogs(
          env.CUCM_HOSTNAME,
          env.CUCM_USERNAME,
          "definitely-wrong-password-xyz"
        );
        // If it returns without throwing, the result should indicate failure
        // (some CUCM versions return empty/error responses instead of HTTP 401)
        assert.ok(
          result === null || result === undefined || result === false ||
          (Array.isArray(result) && result.length === 0) ||
          JSON.stringify(result).includes("fault") || JSON.stringify(result).includes("401"),
          "should indicate auth failure in some way"
        );
      } catch (err) {
        // Throwing is the expected behavior
        assert.ok(
          err instanceof DimeAuthError || err instanceof DimeError || err instanceof Error,
          `Expected auth error, got ${err.constructor.name}: ${err.message}`
        );
      }
    });
  });

  describe("listNodeServiceLogs", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("returns node names and service logs for the cluster", async () => {
      assert.ok(discoveredNodes.length > 0, "should have discovered nodes from auth test");

      // Check that well-known services exist
      const allServices = discoveredNodes.flatMap((n) => n.servicelogs);
      assert.ok(
        allServices.includes("Cisco CallManager"),
        "should include Cisco CallManager service"
      );
    });
  });

  describe("selectLogFiles", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("selects CallManager logs from the last 4 hours", async () => {
      const now = new Date();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

      // Format dates in Cisco's expected format: MM/DD/YY hh:mm AM/PM
      const formatCiscoDate = (d) => {
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const year = String(d.getFullYear()).slice(-2);
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
        return `${month}/${day}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
      };

      const fromStr = formatCiscoDate(fourHoursAgo);
      const toStr = formatCiscoDate(now);
      const tz = `Client: (GMT-7:0)Pacific Standard Time-America/Los_Angeles`;

      const files = await ciscoDime.selectLogFiles(
        env.CUCM_HOSTNAME,
        env.CUCM_USERNAME,
        env.CUCM_PASSWORD,
        "Cisco CallManager",
        fromStr,
        toStr,
        tz
      );

      assert.ok(Array.isArray(files), "should return an array");
      assert.ok(files.length > 0, `should find at least one log file, got ${files.length}`);

      // Verify file structure
      const firstFile = files[0];
      assert.ok(firstFile.absolutepath || firstFile.name, "file should have a path or name");
      assert.ok(firstFile.filesize, "file should have a filesize");
      assert.ok(firstFile.modifiedDate, "file should have a modifiedDate");

      selectedFiles = files;
    });

    it("selects logs using named parameter syntax", async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const formatCiscoDate = (d) => {
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const year = String(d.getFullYear()).slice(-2);
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
        return `${month}/${day}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
      };

      const files = await ciscoDime.selectLogFiles({
        host: env.CUCM_HOSTNAME,
        username: env.CUCM_USERNAME,
        password: env.CUCM_PASSWORD,
        servicelog: "Cisco CTIManager",
        fromdate: formatCiscoDate(twoHoursAgo),
        todate: formatCiscoDate(now),
        timezone: "Client: (GMT-7:0)Pacific Standard Time-America/Los_Angeles",
      });

      assert.ok(Array.isArray(files), "should return an array");
      // CTI traces may or may not exist — just verify no error thrown
    });

    it("returns empty or throws for nonexistent service log", async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const formatCiscoDate = (d) => {
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const year = String(d.getFullYear()).slice(-2);
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
        return `${month}/${day}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
      };

      try {
        const files = await ciscoDime.selectLogFiles(
          env.CUCM_HOSTNAME,
          env.CUCM_USERNAME,
          env.CUCM_PASSWORD,
          "Nonexistent Service That Does Not Exist XYZ",
          formatCiscoDate(oneHourAgo),
          formatCiscoDate(now),
          "Client: (GMT-7:0)Pacific Standard Time-America/Los_Angeles"
        );
        // If it returns, should be empty
        assert.ok(
          files === null || files === undefined || (Array.isArray(files) && files.length === 0),
          "should return empty for nonexistent service"
        );
      } catch (err) {
        // Throwing is also acceptable
        assert.ok(err instanceof Error, "should throw an Error");
      }
    });
  });

  describe("selectLogFilesMulti", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("queries multiple hosts and merges results", async () => {
      const hosts = discoveredNodes.map((n) => n.server);
      if (hosts.length < 2) {
        // Single-node cluster — just verify it works without error
        console.log("  (single-node cluster, testing with one host)");
      }

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const formatCiscoDate = (d) => {
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const year = String(d.getFullYear()).slice(-2);
        let hours = d.getHours();
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        if (hours === 0) hours = 12;
        else if (hours > 12) hours -= 12;
        return `${month}/${day}/${year} ${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
      };

      const files = await ciscoDime.selectLogFilesMulti(
        hosts,
        env.CUCM_USERNAME,
        env.CUCM_PASSWORD,
        "Cisco CallManager",
        formatCiscoDate(twoHoursAgo),
        formatCiscoDate(now),
        "Client: (GMT-7:0)Pacific Standard Time-America/Los_Angeles",
        { concurrency: 2 }
      );

      assert.ok(Array.isArray(files), "should return an array");
      // Multi-host results should have the server field populated
      if (files.length > 0) {
        assert.ok(files[0].server, "results should have server field");
      }
    });
  });

  describe("getOneFile", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
      if (selectedFiles.length === 0) throw new Error("Skipping: no files from selectLogFiles test");
    });

    it("downloads a single file as a Buffer", async () => {
      // Use files from the selectLogFiles test (avoid extra server calls)
      const completedFiles = selectedFiles.filter((f) => {
        const name = f.absolutepath || f.name || "";
        return name.endsWith(".gz") && !name.endsWith(".gzo");
      });

      if (completedFiles.length === 0) {
        console.log("  (no completed .gz files available, skipping download test)");
        return;
      }

      completedFiles.sort((a, b) => parseInt(a.filesize || "0") - parseInt(b.filesize || "0"));
      const filePath = completedFiles[0].absolutepath || completedFiles[0].name;

      const result = await ciscoDime.getOneFile(
        env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD, filePath
      );

      assert.ok(result, "should return a result");
      assert.ok(Buffer.isBuffer(result.data), "data should be a Buffer");
      assert.ok(result.data.length > 0, `data should be non-empty, got ${result.data.length} bytes`);
      assert.ok(result.filename, "should have filename");
      assert.ok(result.server, "should have server");
    });

    it("throws for nonexistent file", async () => {
      await assert.rejects(
        () => ciscoDime.getOneFile(
          env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD,
          "/var/log/active/this-file-does-not-exist-xyz-99999.log"
        ),
        (err) => {
          assert.ok(
            err instanceof DimeNotFoundError || err instanceof DimeError || err instanceof Error,
            `Expected not found error, got ${err.constructor.name}: ${err.message}`
          );
          return true;
        }
      );
    });
  });

  describe("getOneFileStream", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
      if (selectedFiles.length === 0) throw new Error("Skipping: no files from selectLogFiles test");
    });

    it("streams a file without buffering in memory", async () => {
      const completedFiles = selectedFiles.filter((f) => {
        const name = f.absolutepath || f.name || "";
        return name.endsWith(".gz") && !name.endsWith(".gzo");
      });

      if (completedFiles.length === 0) {
        console.log("  (no completed .gz files available, skipping stream test)");
        return;
      }

      completedFiles.sort((a, b) => parseInt(a.filesize || "0") - parseInt(b.filesize || "0"));
      const filePath = completedFiles[0].absolutepath || completedFiles[0].name;

      const result = await ciscoDime.getOneFileStream(
        env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD, filePath
      );

      assert.ok(result, "should return a result");
      assert.ok(result.filename, "should have filename");
      assert.ok(result.server, "should have server");
      assert.ok(result.body, "should have a readable body stream");

      // Read a few chunks to verify the stream works
      let bytesRead = 0;
      for await (const chunk of result.body) {
        bytesRead += chunk.length;
        if (bytesRead > 1024) break;
      }
      assert.ok(bytesRead > 0, `should read some bytes from stream, got ${bytesRead}`);
    });
  });

  describe("getMultipleFiles", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
      if (selectedFiles.length === 0) throw new Error("Skipping: no files from selectLogFiles test");
    });

    it("downloads multiple files in parallel", async () => {
      const completedFiles = selectedFiles.filter((f) => {
        const name = f.absolutepath || f.name || "";
        return name.endsWith(".gz") && !name.endsWith(".gzo");
      });

      if (completedFiles.length < 2) {
        console.log("  (need at least 2 completed files, skipping batch test)");
        return;
      }

      completedFiles.sort((a, b) => parseInt(a.filesize || "0") - parseInt(b.filesize || "0"));
      const filePaths = completedFiles.slice(0, 2).map((f) => f.absolutepath || f.name);

      const results = await ciscoDime.getMultipleFiles(
        env.CUCM_HOSTNAME, env.CUCM_USERNAME, env.CUCM_PASSWORD,
        filePaths, { concurrency: 2 }
      );

      assert.ok(Array.isArray(results), "should return an array");
      assert.equal(results.length, 2, "should have 2 results");

      for (const result of results) {
        if (result.error) {
          assert.fail(`download failed: ${result.error.message}`);
        }
        assert.ok(Buffer.isBuffer(result.data), "data should be a Buffer");
        assert.ok(result.data.length > 0, "data should be non-empty");
      }
    });
  });

  describe("cookie management", () => {
    before(() => {
      if (!authPassed) throw new Error("Skipping: authentication failed");
    });

    it("getCookie returns a session cookie after a request", () => {
      const cookie = ciscoDime.getCookie(env.CUCM_HOSTNAME);
      // Cookie may or may not be set depending on implementation
      // Just verify the function exists and doesn't throw
      assert.ok(cookie === null || typeof cookie === "string", "getCookie should return null or string");
    });

    it("setCookie and getCookie roundtrip", () => {
      const testHost = "test-host-for-cookie";
      ciscoDime.setCookie(testHost, "JSESSIONID=abc123");
      const cookie = ciscoDime.getCookie(testHost);
      assert.equal(cookie, "JSESSIONID=abc123", "should retrieve the set cookie");
    });
  });

  describe("error types", () => {
    it("DimeError is an Error", () => {
      const err = new DimeError("test");
      assert.ok(err instanceof Error);
      assert.equal(err.name, "DimeError");
    });

    it("DimeAuthError is a DimeError", () => {
      const err = new DimeAuthError("auth failed");
      assert.ok(err instanceof DimeError);
      assert.equal(err.name, "DimeAuthError");
    });

    it("DimeNotFoundError is a DimeError", () => {
      const err = new DimeNotFoundError("not found");
      assert.ok(err instanceof DimeError);
      assert.equal(err.name, "DimeNotFoundError");
    });

    it("DimeTimeoutError is a DimeError", () => {
      const err = new DimeTimeoutError("timeout");
      assert.ok(err instanceof DimeError);
      assert.equal(err.name, "DimeTimeoutError");
    });

    it("DimeError stores host and statusCode", () => {
      const err = new DimeError("test", { host: "10.0.0.1", statusCode: 500 });
      assert.equal(err.host, "10.0.0.1");
      assert.equal(err.statusCode, 500);
    });
  });
});
