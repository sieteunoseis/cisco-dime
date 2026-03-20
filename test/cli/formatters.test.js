const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const formatJson = require("../../cli/formatters/json.js");
const formatCsv = require("../../cli/formatters/csv.js");
const formatTable = require("../../cli/formatters/table.js");

const sampleList = [
  { index: 1, filename: "/path/a.gz", size: "12KB", modified: "2026-03-19 10:15", host: "10.0.0.1" },
  { index: 2, filename: "/path/b.gz", size: "8KB", modified: "2026-03-19 10:30", host: "10.0.0.1" },
];
const sampleItem = { server: "cucm-pub.lab.local", servicelogs: ["Cisco CallManager", "Cisco CTIManager"], count: 2 };

describe("json formatter", () => {
  it("formats a list as pretty JSON", () => {
    const out = formatJson(sampleList);
    const parsed = JSON.parse(out);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].filename, "/path/a.gz");
  });
  it("formats a single item as pretty JSON", () => {
    const out = formatJson(sampleItem);
    assert.equal(JSON.parse(out).server, "cucm-pub.lab.local");
  });
});

describe("csv formatter", () => {
  it("formats a list as CSV with headers", () => {
    const out = formatCsv(sampleList);
    const lines = out.trim().split("\n");
    assert.equal(lines[0], "index,filename,size,modified,host");
    assert.equal(lines.length, 3);
  });
  it("formats a single item as CSV", () => {
    const out = formatCsv(sampleItem);
    assert.equal(out.trim().split("\n").length, 2);
  });
});

describe("table formatter", () => {
  it("formats a list as a table string", () => {
    const out = formatTable(sampleList);
    assert.ok(out.includes("/path/a.gz"));
    assert.ok(out.includes("12KB"));
    assert.ok(out.includes("2 results"));
  });
  it("formats a single item as key-value pairs", () => {
    const out = formatTable(sampleItem);
    assert.ok(out.includes("server"));
    assert.ok(out.includes("cucm-pub.lab.local"));
  });
});
