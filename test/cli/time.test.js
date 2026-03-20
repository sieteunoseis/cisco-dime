const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const time = require("../../cli/utils/time.js");

describe("parseDuration", () => {
  it("parses minutes", () => {
    assert.equal(time.parseDuration("30m"), 30 * 60 * 1000);
  });
  it("parses hours", () => {
    assert.equal(time.parseDuration("2h"), 2 * 60 * 60 * 1000);
  });
  it("parses days", () => {
    assert.equal(time.parseDuration("1d"), 24 * 60 * 60 * 1000);
  });
  it("parses arbitrary values", () => {
    assert.equal(time.parseDuration("45m"), 45 * 60 * 1000);
  });
  it("throws for invalid format", () => {
    assert.throws(() => time.parseDuration("abc"), /Invalid duration/);
  });
});

describe("toCiscoDate", () => {
  it("converts Date to Cisco format", () => {
    const date = new Date(2026, 2, 19, 8, 0);
    assert.equal(time.toCiscoDate(date), "03/19/26 08:00 AM");
  });
  it("handles PM times", () => {
    const date = new Date(2026, 2, 19, 14, 30);
    assert.equal(time.toCiscoDate(date), "03/19/26 02:30 PM");
  });
  it("handles midnight as 12:00 AM", () => {
    const date = new Date(2026, 2, 19, 0, 0);
    assert.equal(time.toCiscoDate(date), "03/19/26 12:00 AM");
  });
  it("handles noon as 12:00 PM", () => {
    const date = new Date(2026, 2, 19, 12, 0);
    assert.equal(time.toCiscoDate(date), "03/19/26 12:00 PM");
  });
});

describe("parseTimeArg", () => {
  it("parses 'now' keyword", () => {
    const before = Date.now();
    const result = time.parseTimeArg("now");
    const after = Date.now();
    assert.ok(result.getTime() >= before && result.getTime() <= after);
  });
  it("parses ISO 8601 string", () => {
    const result = time.parseTimeArg("2026-03-19T08:00:00");
    assert.equal(result.getFullYear(), 2026);
    assert.equal(result.getMonth(), 2);
    assert.equal(result.getHours(), 8);
  });
  it("parses date-time string", () => {
    const result = time.parseTimeArg("2026-03-19 08:00");
    assert.equal(result.getFullYear(), 2026);
    assert.equal(result.getHours(), 8);
  });
  it("throws for unparseable string", () => {
    assert.throws(() => time.parseTimeArg("not-a-date"), /Cannot parse/);
  });
});

describe("resolveTimeRange", () => {
  it("resolves --last to from/to", () => {
    const { from, to } = time.resolveTimeRange({ last: "30m" });
    const diff = to.getTime() - from.getTime();
    assert.ok(Math.abs(diff - 30 * 60 * 1000) < 1000);
  });
  it("resolves --from and --to", () => {
    const { from, to } = time.resolveTimeRange({ from: "2026-03-19 08:00", to: "2026-03-19 09:00" });
    assert.equal(from.getHours(), 8);
    assert.equal(to.getHours(), 9);
  });
  it("throws when --last and --from both provided", () => {
    assert.throws(() => { time.resolveTimeRange({ last: "30m", from: "2026-03-19 08:00" }); }, /mutually exclusive/);
  });
  it("throws when neither --last nor --from provided", () => {
    assert.throws(() => { time.resolveTimeRange({}); }, /time range/i);
  });
});

describe("toCiscoTimezone", () => {
  it("converts America/Chicago", () => {
    const result = time.toCiscoTimezone("America/Chicago");
    assert.ok(result.includes("America/Chicago"));
    assert.ok(result.startsWith("Client:"));
  });
  it("converts America/New_York", () => {
    const result = time.toCiscoTimezone("America/New_York");
    assert.ok(result.includes("America/New_York"));
  });
  it("converts UTC", () => {
    const result = time.toCiscoTimezone("UTC");
    assert.ok(result.includes("UTC") || result.includes("GMT"));
  });
  it("throws for unknown timezone", () => {
    assert.throws(() => time.toCiscoTimezone("Fake/Zone"), /Unknown timezone/);
  });
});
