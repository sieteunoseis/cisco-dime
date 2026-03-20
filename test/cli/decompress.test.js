const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { gzipSync } = require("node:zlib");
const decompress = require("../../cli/utils/decompress.js");

describe("decompress utility", () => {
  it("decompresses valid .gz buffer", () => {
    const original = Buffer.from("hello world");
    const compressed = gzipSync(original);
    const result = decompress.tryDecompress(compressed, "test.txt.gz");
    assert.equal(result.success, true);
    assert.deepEqual(result.data, original);
    assert.equal(result.outputName, "test.txt");
  });
  it("detects truncated .gz buffer", () => {
    const original = Buffer.from("hello world");
    const compressed = gzipSync(original);
    const truncated = compressed.subarray(0, compressed.length - 5);
    const result = decompress.tryDecompress(truncated, "test.txt.gz");
    assert.equal(result.success, false);
    assert.ok(result.warning.includes("truncated"));
  });
  it("strips .gz extension for output name", () => {
    assert.equal(decompress.stripGzExtension("file.txt.gz"), "file.txt");
    assert.equal(decompress.stripGzExtension("file.txt"), "file.txt");
  });
  it("strips .gzo extension for output name", () => {
    assert.equal(decompress.stripGzExtension("file.txt.gzo"), "file.txt");
  });
  it("isGzFile detects .gz extension", () => {
    assert.equal(decompress.isGzFile("file.gz"), true);
    assert.equal(decompress.isGzFile("file.txt"), false);
  });
  it("isGzFile detects .gzo extension", () => {
    assert.equal(decompress.isGzFile("file.txt.gzo"), true);
  });
});
