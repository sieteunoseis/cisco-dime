const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let configModule;
let testDir;

describe("config utility", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-dime-test-"));
    process.env.CISCO_DIME_CONFIG_DIR = testDir;
    delete require.cache[require.resolve("../../cli/utils/config.js")];
    configModule = require("../../cli/utils/config.js");
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.CISCO_DIME_CONFIG_DIR;
  });

  it("addCluster creates config file with cluster", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    const config = configModule.loadConfig();
    assert.equal(config.activeCluster, "lab");
    assert.equal(config.clusters.lab.host, "10.0.0.1");
  });

  it("useCluster switches active cluster", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    configModule.addCluster("prod", { host: "10.0.0.2", username: "axladmin", password: "secret2" });
    configModule.useCluster("lab");
    const config = configModule.loadConfig();
    assert.equal(config.activeCluster, "lab");
  });

  it("useCluster throws for unknown cluster", () => {
    assert.throws(() => { configModule.useCluster("nonexistent"); }, /not found/);
  });

  it("removeCluster removes a cluster", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    configModule.removeCluster("lab");
    const config = configModule.loadConfig();
    assert.equal(config.clusters.lab, undefined);
  });

  it("getActiveCluster returns resolved cluster config", () => {
    configModule.addCluster("lab", { host: "10.0.0.1", username: "admin", password: "secret" });
    const cluster = configModule.getActiveCluster();
    assert.equal(cluster.host, "10.0.0.1");
    assert.equal(cluster.name, "lab");
  });

  it("maskPassword replaces password with asterisks", () => {
    assert.equal(configModule.maskPassword("secret"), "******");
    assert.equal(configModule.maskPassword("<ss:123:password>"), "<ss:123:password>");
  });

  it("detectSsPlaceholders finds <ss:ID:field> patterns", () => {
    assert.equal(configModule.hasSsPlaceholders({ password: "<ss:123:password>" }), true);
    assert.equal(configModule.hasSsPlaceholders({ password: "plaintext" }), false);
  });

  it("addPreset stores a custom preset", () => {
    configModule.addPreset("my-logs", ["Service A", "Service B"]);
    const config = configModule.loadConfig();
    assert.deepEqual(config.presets["my-logs"].services, ["Service A", "Service B"]);
  });

  it("removePreset removes a custom preset", () => {
    configModule.addPreset("my-logs", ["Service A"]);
    configModule.removePreset("my-logs");
    const config = configModule.loadConfig();
    assert.equal(config.presets["my-logs"], undefined);
  });

  it("removePreset throws for built-in preset", () => {
    assert.throws(() => { configModule.removePreset("sip-traces"); }, /built-in/);
  });

  it("getPreset returns built-in preset", () => {
    const preset = configModule.getPreset("sip-traces");
    assert.deepEqual(preset.services, ["Cisco CallManager", "Cisco CTIManager"]);
  });

  it("getPreset custom overrides built-in", () => {
    configModule.addPreset("sip-traces", ["Custom SIP Service"]);
    const preset = configModule.getPreset("sip-traces");
    assert.deepEqual(preset.services, ["Custom SIP Service"]);
  });

  it("listPresets returns built-in and custom", () => {
    configModule.addPreset("my-logs", ["Service A"]);
    const presets = configModule.listPresets();
    assert.ok(presets.find((p) => p.name === "sip-traces" && p.builtIn));
    assert.ok(presets.find((p) => p.name === "my-logs" && !p.builtIn));
  });
});
