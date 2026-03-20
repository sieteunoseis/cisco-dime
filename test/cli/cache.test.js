const assert = require("node:assert/strict");
const { describe, it, beforeEach, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

let cacheModule;
let testDir;

describe("cache utility", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cisco-dime-cache-"));
    process.env.CISCO_DIME_CONFIG_DIR = testDir;
    delete require.cache[require.resolve("../../cli/utils/cache.js")];
    delete require.cache[require.resolve("../../cli/utils/config.js")];
    cacheModule = require("../../cli/utils/cache.js");
  });
  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    delete process.env.CISCO_DIME_CONFIG_DIR;
  });

  it("saveSelectResults and loadSelectResults roundtrip", () => {
    const files = [
      { index: 1, filename: "/path/a.gz", size: "1024", modified: "2026-03-19", host: "10.0.0.1" },
      { index: 2, filename: "/path/b.gz", size: "2048", modified: "2026-03-19", host: "10.0.0.1" },
    ];
    cacheModule.saveSelectResults(files);
    assert.deepEqual(cacheModule.loadSelectResults(), files);
  });
  it("loadSelectResults returns null when no cache", () => {
    assert.equal(cacheModule.loadSelectResults(), null);
  });
  it("parseIndices handles comma-separated", () => {
    assert.deepEqual(cacheModule.parseIndices("1,3,5"), [1, 3, 5]);
  });
  it("parseIndices handles range", () => {
    assert.deepEqual(cacheModule.parseIndices("1-5"), [1, 2, 3, 4, 5]);
  });
  it("parseIndices handles mixed", () => {
    assert.deepEqual(cacheModule.parseIndices("1,3-5,8"), [1, 3, 4, 5, 8]);
  });
  it("resolveFiles returns matching files by index", () => {
    const files = [
      { index: 1, filename: "/path/a.gz", host: "h1" },
      { index: 2, filename: "/path/b.gz", host: "h1" },
      { index: 3, filename: "/path/c.gz", host: "h1" },
    ];
    cacheModule.saveSelectResults(files);
    const resolved = cacheModule.resolveFiles("1,3");
    assert.equal(resolved.length, 2);
    assert.equal(resolved[0].filename, "/path/a.gz");
    assert.equal(resolved[1].filename, "/path/c.gz");
  });
  it("resolveFiles throws for invalid index", () => {
    cacheModule.saveSelectResults([{ index: 1, filename: "/path/a.gz", host: "h1" }]);
    assert.throws(() => cacheModule.resolveFiles("5"), /Index 5 not found/);
  });
});
