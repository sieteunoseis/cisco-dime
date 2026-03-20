const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let connectionModule;
let testDir;

describe("connection utility", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-dime-conn-"));
    process.env.CISCO_DIME_CONFIG_DIR = testDir;
    delete process.env.CUCM_HOST;
    delete process.env.CUCM_HOSTNAME;
    delete process.env.CUCM_USERNAME;
    delete process.env.CUCM_PASSWORD;
    delete require.cache[require.resolve("../../cli/utils/connection.js")];
    delete require.cache[require.resolve("../../cli/utils/config.js")];
    connectionModule = require("../../cli/utils/connection.js");
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.CISCO_DIME_CONFIG_DIR;
  });

  it("resolveConfig prefers CLI flags over everything", () => {
    const config = connectionModule.resolveConfig({ host: "flag-host", username: "flag-user", password: "flag-pass" });
    assert.equal(config.host, "flag-host");
    assert.equal(config.username, "flag-user");
  });

  it("resolveConfig falls back to env vars", () => {
    process.env.CUCM_HOST = "env-host";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    const config = connectionModule.resolveConfig({});
    assert.equal(config.host, "env-host");
    assert.equal(config.username, "env-user");
  });

  it("resolveConfig accepts CUCM_HOSTNAME alias", () => {
    process.env.CUCM_HOSTNAME = "env-hostname";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    const config = connectionModule.resolveConfig({});
    assert.equal(config.host, "env-hostname");
  });

  it("resolveConfig falls back to config file", () => {
    const configMod = require("../../cli/utils/config.js");
    configMod.addCluster("lab", { host: "file-host", username: "file-user", password: "file-pass" });
    const config = connectionModule.resolveConfig({});
    assert.equal(config.host, "file-host");
  });

  it("resolveConfig throws when no config available", () => {
    assert.throws(() => { connectionModule.resolveConfig({}); }, /No cluster configured/);
  });

  it("resolveConfig flag overrides env partially", () => {
    process.env.CUCM_HOST = "env-host";
    process.env.CUCM_USERNAME = "env-user";
    process.env.CUCM_PASSWORD = "env-pass";
    const config = connectionModule.resolveConfig({ host: "flag-host" });
    assert.equal(config.host, "flag-host");
    assert.equal(config.username, "env-user");
  });
});
