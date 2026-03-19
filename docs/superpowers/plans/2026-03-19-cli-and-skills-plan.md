# cisco-dime CLI & Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a CLI (`cisco-dime`) and skills.sh skill to the existing cisco-dime npm library, enabling admins, developers, and AI agents to select and download log files from Cisco UC products via DIME from the command line.

**Architecture:** Commander.js CLI in plain JS under `cli/`, with a `bin/cisco-dime.js` entry point. The CLI imports the library from `main.js`. Four output formatters (table, json, toon, csv). Multi-cluster config stored at `~/.cisco-dime/config.json` with optional Secret Server placeholder resolution. Select results cached to `~/.cisco-dime/last-select.json` for indexed download workflow. A `skills/` folder provides an AI-agent-facing skill for skills.sh.

**Tech Stack:** Commander.js, cli-table3, @toon-format/toon, csv-stringify, Node.js (plain JS for CLI code)

**Spec:** `docs/superpowers/specs/2026-03-19-cli-and-skills-design.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `bin/cisco-dime.js` | CLI entry point (`#!/usr/bin/env node`), loads `cli/index.js` |
| `cli/index.js` | Commander program setup, version, global flags, registers all commands |
| `cli/utils/config.js` | Read/write `~/.cisco-dime/config.json`, `<ss:ID:field>` resolution, password masking, preset management |
| `cli/utils/connection.js` | Resolve config (flags > env > file), handle `--insecure`, return connection params |
| `cli/utils/output.js` | Format and print results using the selected formatter, handle errors to stderr |
| `cli/utils/time.js` | Flexible time parser (`30m`, `2h`, `now`), Cisco date format conversion (`MM/DD/YY hh:mm AM`), IANA → Cisco timezone conversion |
| `cli/utils/cache.js` | Read/write `~/.cisco-dime/last-select.json`, index parsing (`1,3,5`, `1-5`) |
| `cli/utils/audit.js` | JSONL audit trail logging and rotation |
| `cli/utils/decompress.js` | `.gz` decompression with truncation detection |
| `cli/formatters/table.js` | Table formatter using cli-table3 |
| `cli/formatters/json.js` | JSON formatter (pretty-print) |
| `cli/formatters/toon.js` | TOON formatter using @toon-format/toon |
| `cli/formatters/csv.js` | CSV formatter using csv-stringify |
| `cli/commands/config.js` | `config add/use/list/show/remove/test/add-preset/list-presets/remove-preset` subcommands |
| `cli/commands/list-services.js` | `list-services` command (node + service log discovery) |
| `cli/commands/select.js` | `select <service|preset>` with time/host options + `--download` |
| `cli/commands/download.js` | `download` by index, range, `--all`, or `--file` |
| `skills/cisco-dime-cli/SKILL.md` | skills.sh skill definition |
| `test/cli/config.test.js` | Tests for config utils |
| `test/cli/connection.test.js` | Tests for connection resolution |
| `test/cli/formatters.test.js` | Tests for all four formatters |
| `test/cli/time.test.js` | Tests for time parser and format conversions |
| `test/cli/cache.test.js` | Tests for select cache and index parsing |
| `test/cli/decompress.test.js` | Tests for decompression and truncation detection |

---

## Task 1: Install Dependencies & Update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install CLI dependencies**

```bash
npm install commander cli-table3 @toon-format/toon csv-stringify
```

- [ ] **Step 2: Add bin field to package.json**

Add the following to package.json at the top level:

```json
"bin": {
  "cisco-dime": "./bin/cisco-dime.js"
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add CLI dependencies and bin entry point"
```

---

## Task 2: Config Utility (`cli/utils/config.js`)

**Files:**
- Create: `cli/utils/config.js`
- Create: `test/cli/config.test.js`

- [ ] **Step 1: Write failing tests for config utility**

Create `test/cli/config.test.js`:

```js
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
    configModule.addCluster("lab", {
      host: "10.0.0.1",
      username: "admin",
      password: "secret",
    });
    const config = configModule.loadConfig();
    assert.equal(config.activeCluster, "lab");
    assert.equal(config.clusters.lab.host, "10.0.0.1");
  });

  it("useCluster switches active cluster", () => {
    configModule.addCluster("lab", {
      host: "10.0.0.1",
      username: "admin",
      password: "secret",
    });
    configModule.addCluster("prod", {
      host: "10.0.0.2",
      username: "axladmin",
      password: "secret2",
    });
    configModule.useCluster("lab");
    const config = configModule.loadConfig();
    assert.equal(config.activeCluster, "lab");
  });

  it("useCluster throws for unknown cluster", () => {
    assert.throws(() => {
      configModule.useCluster("nonexistent");
    }, /not found/);
  });

  it("removeCluster removes a cluster", () => {
    configModule.addCluster("lab", {
      host: "10.0.0.1",
      username: "admin",
      password: "secret",
    });
    configModule.removeCluster("lab");
    const config = configModule.loadConfig();
    assert.equal(config.clusters.lab, undefined);
  });

  it("getActiveCluster returns resolved cluster config", () => {
    configModule.addCluster("lab", {
      host: "10.0.0.1",
      username: "admin",
      password: "secret",
    });
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
    assert.throws(() => {
      configModule.removePreset("sip-traces");
    }, /built-in/);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/config.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement config utility**

Create `cli/utils/config.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");

const SS_PLACEHOLDER_RE = /<ss:(\d+):(\w+)>/g;

const BUILT_IN_PRESETS = {
  "sip-traces": { services: ["Cisco CallManager", "Cisco CTIManager"] },
  "cti-traces": { services: ["Cisco CTIManager"] },
  "curri-logs": { services: ["Cisco Extended Functions"] },
  "syslog": { services: ["messages", "CiscoSyslog"] },
  "tomcat": { services: ["Tomcat", "Tomcat Security"] },
  "oamp": { services: ["Cisco Unified OS Admin", "Cisco Unified CM Admin"] },
  "audit": { services: ["Cisco Audit Event Service"] },
};

function getConfigDir() {
  return process.env.CISCO_DIME_CONFIG_DIR || path.join(os.homedir(), ".cisco-dime");
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

function loadConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { activeCluster: null, clusters: {}, presets: {} };
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  if (!config.presets) config.presets = {};
  return config;
}

function saveConfig(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}

function addCluster(name, opts) {
  const config = loadConfig();
  config.clusters[name] = {
    host: opts.host,
    username: opts.username,
    password: opts.password,
  };
  if (opts.insecure) {
    config.clusters[name].insecure = true;
  }
  if (!config.activeCluster) {
    config.activeCluster = name;
  }
  saveConfig(config);
}

function useCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) {
    throw new Error(`Cluster "${name}" not found. Run "cisco-dime config list" to see available clusters.`);
  }
  config.activeCluster = name;
  saveConfig(config);
}

function removeCluster(name) {
  const config = loadConfig();
  if (!config.clusters[name]) {
    throw new Error(`Cluster "${name}" not found.`);
  }
  delete config.clusters[name];
  if (config.activeCluster === name) {
    const remaining = Object.keys(config.clusters);
    config.activeCluster = remaining.length > 0 ? remaining[0] : null;
  }
  saveConfig(config);
}

function getActiveCluster(clusterName) {
  const config = loadConfig();
  const name = clusterName || config.activeCluster;
  if (!name || !config.clusters[name]) {
    return null;
  }
  return { name, ...config.clusters[name] };
}

function listClusters() {
  const config = loadConfig();
  return { activeCluster: config.activeCluster, clusters: config.clusters };
}

function maskPassword(password) {
  if (!password) return "";
  if (SS_PLACEHOLDER_RE.test(password)) {
    SS_PLACEHOLDER_RE.lastIndex = 0;
    return password;
  }
  return "*".repeat(password.length);
}

function hasSsPlaceholders(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && SS_PLACEHOLDER_RE.test(value)) {
      SS_PLACEHOLDER_RE.lastIndex = 0;
      return true;
    }
  }
  return false;
}

function resolveSsPlaceholders(obj) {
  const resolved = { ...obj };
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value !== "string") continue;
    SS_PLACEHOLDER_RE.lastIndex = 0;
    resolved[key] = value.replace(SS_PLACEHOLDER_RE, (match, id, field) => {
      try {
        const output = execSync(`ss-cli get ${id} --format json`, {
          encoding: "utf-8",
          timeout: 10000,
        });
        const secret = JSON.parse(output);
        if (secret[field] !== undefined) return secret[field];
        if (Array.isArray(secret.items)) {
          const item = secret.items.find(
            (i) => i.fieldName === field || i.slug === field
          );
          if (item) return item.itemValue;
        }
        throw new Error(`Field "${field}" not found in secret ${id}`);
      } catch (err) {
        if (err.message.includes("ENOENT") || err.message.includes("not found")) {
          throw new Error(
            `Config contains Secret Server references (<ss:...>) but ss-cli is not available. Install with: npm install -g @sieteunoseis/ss-cli`
          );
        }
        throw err;
      }
    });
  }
  return resolved;
}

function addPreset(name, services) {
  const config = loadConfig();
  config.presets[name] = { services };
  saveConfig(config);
}

function removePreset(name) {
  const config = loadConfig();
  if (config.presets[name]) {
    // Custom preset (possibly overriding a built-in) — remove the override
    delete config.presets[name];
    saveConfig(config);
    return;
  }
  if (BUILT_IN_PRESETS[name]) {
    throw new Error(`Cannot remove built-in preset "${name}". You can override it with config add-preset.`);
  }
  throw new Error(`Preset "${name}" not found.`);
}

function getPreset(name) {
  const config = loadConfig();
  // Custom presets override built-in
  if (config.presets[name]) {
    return config.presets[name];
  }
  if (BUILT_IN_PRESETS[name]) {
    return BUILT_IN_PRESETS[name];
  }
  return null;
}

function listPresets() {
  const config = loadConfig();
  const result = [];
  // Built-in presets
  for (const [name, preset] of Object.entries(BUILT_IN_PRESETS)) {
    const overridden = !!config.presets[name];
    result.push({
      name,
      services: overridden ? config.presets[name].services : preset.services,
      builtIn: !overridden,
    });
  }
  // Custom-only presets
  for (const [name, preset] of Object.entries(config.presets)) {
    if (!BUILT_IN_PRESETS[name]) {
      result.push({ name, services: preset.services, builtIn: false });
    }
  }
  return result;
}

module.exports = {
  getConfigDir,
  loadConfig,
  saveConfig,
  addCluster,
  useCluster,
  removeCluster,
  getActiveCluster,
  listClusters,
  maskPassword,
  hasSsPlaceholders,
  resolveSsPlaceholders,
  addPreset,
  removePreset,
  getPreset,
  listPresets,
  BUILT_IN_PRESETS,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/config.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/utils/config.js test/cli/config.test.js
git commit -m "feat(cli): add config utility with multi-cluster, ss-cli, and preset support"
```

---

## Task 3: Connection Utility (`cli/utils/connection.js`)

**Files:**
- Create: `cli/utils/connection.js`
- Create: `test/cli/connection.test.js`

- [ ] **Step 1: Write failing tests for connection utility**

Create `test/cli/connection.test.js`:

```js
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
    const config = connectionModule.resolveConfig({
      host: "flag-host",
      username: "flag-user",
      password: "flag-pass",
    });
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
    configMod.addCluster("lab", {
      host: "file-host",
      username: "file-user",
      password: "file-pass",
    });
    const config = connectionModule.resolveConfig({});
    assert.equal(config.host, "file-host");
  });

  it("resolveConfig throws when no config available", () => {
    assert.throws(() => {
      connectionModule.resolveConfig({});
    }, /No cluster configured/);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/connection.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement connection utility**

Create `cli/utils/connection.js`:

```js
const configUtil = require("./config.js");

function resolveConfig(flags) {
  const env = {
    host: process.env.CUCM_HOST || process.env.CUCM_HOSTNAME || undefined,
    username: process.env.CUCM_USERNAME || undefined,
    password: process.env.CUCM_PASSWORD || undefined,
  };

  let fileConfig = {};
  const clusterName = flags.cluster || undefined;
  const cluster = configUtil.getActiveCluster(clusterName);
  if (cluster) {
    fileConfig = cluster;
  }

  // Merge with precedence: flags > env > file
  const resolved = {
    host: flags.host || env.host || fileConfig.host,
    username: flags.username || env.username || fileConfig.username,
    password: flags.password || env.password || fileConfig.password,
    insecure: flags.insecure || fileConfig.insecure || false,
  };

  if (!resolved.host || !resolved.username || !resolved.password) {
    throw new Error(
      'No cluster configured. Set one up with:\n' +
      '  cisco-dime config add <name> --host <h> --username <u> --password <p>\n' +
      '  Or set environment variables: CUCM_HOST, CUCM_USERNAME, CUCM_PASSWORD'
    );
  }

  // Resolve ss-cli placeholders if present
  if (configUtil.hasSsPlaceholders(resolved)) {
    const resolvedSecrets = configUtil.resolveSsPlaceholders(resolved);
    Object.assign(resolved, resolvedSecrets);
  }

  return resolved;
}

module.exports = { resolveConfig };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/connection.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/utils/connection.js test/cli/connection.test.js
git commit -m "feat(cli): add connection utility with config precedence resolution"
```

---

## Task 4: Time Parser Utility (`cli/utils/time.js`)

**Files:**
- Create: `cli/utils/time.js`
- Create: `test/cli/time.test.js`

The time parser handles three responsibilities:
1. Parse flexible duration strings (`30m`, `2h`, `1d`) and date strings into Date objects
2. Convert Date objects to Cisco's required `MM/DD/YY hh:mm AM/PM` format
3. Convert IANA timezone names to Cisco's proprietary format string

- [ ] **Step 1: Write failing tests for time utility**

Create `test/cli/time.test.js`:

```js
const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const time = require("../../cli/utils/time.js");

describe("parseDuration", () => {
  it("parses minutes", () => {
    const result = time.parseDuration("30m");
    assert.equal(result, 30 * 60 * 1000);
  });

  it("parses hours", () => {
    const result = time.parseDuration("2h");
    assert.equal(result, 2 * 60 * 60 * 1000);
  });

  it("parses days", () => {
    const result = time.parseDuration("1d");
    assert.equal(result, 24 * 60 * 60 * 1000);
  });

  it("parses arbitrary values", () => {
    const result = time.parseDuration("45m");
    assert.equal(result, 45 * 60 * 1000);
  });

  it("throws for invalid format", () => {
    assert.throws(() => time.parseDuration("abc"), /Invalid duration/);
  });
});

describe("toCiscoDate", () => {
  it("converts Date to Cisco format", () => {
    const date = new Date(2026, 2, 19, 8, 0); // March 19, 2026 8:00 AM
    const result = time.toCiscoDate(date);
    assert.equal(result, "03/19/26 08:00 AM");
  });

  it("handles PM times", () => {
    const date = new Date(2026, 2, 19, 14, 30); // 2:30 PM
    const result = time.toCiscoDate(date);
    assert.equal(result, "03/19/26 02:30 PM");
  });

  it("handles midnight as 12:00 AM", () => {
    const date = new Date(2026, 2, 19, 0, 0);
    const result = time.toCiscoDate(date);
    assert.equal(result, "03/19/26 12:00 AM");
  });

  it("handles noon as 12:00 PM", () => {
    const date = new Date(2026, 2, 19, 12, 0);
    const result = time.toCiscoDate(date);
    assert.equal(result, "03/19/26 12:00 PM");
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
    assert.equal(result.getMonth(), 2); // March = 2
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
    assert.ok(Math.abs(diff - 30 * 60 * 1000) < 1000); // within 1 second
  });

  it("resolves --from and --to", () => {
    const { from, to } = time.resolveTimeRange({
      from: "2026-03-19 08:00",
      to: "2026-03-19 09:00",
    });
    assert.equal(from.getHours(), 8);
    assert.equal(to.getHours(), 9);
  });

  it("throws when --last and --from both provided", () => {
    assert.throws(() => {
      time.resolveTimeRange({ last: "30m", from: "2026-03-19 08:00" });
    }, /mutually exclusive/);
  });

  it("throws when neither --last nor --from provided", () => {
    assert.throws(() => {
      time.resolveTimeRange({});
    }, /time range/i);
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/time.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement time utility**

Create `cli/utils/time.js`:

```js
const DURATION_RE = /^(\d+)(m|h|d)$/;

const CISCO_TIMEZONES = {
  "Pacific/Honolulu": "Client: (GMT-10:0)Hawaii Standard Time-Pacific/Honolulu",
  "America/Anchorage": "Client: (GMT-9:0)Alaska Standard Time-America/Anchorage",
  "America/Los_Angeles": "Client: (GMT-8:0)Pacific Standard Time-America/Los_Angeles",
  "America/Denver": "Client: (GMT-7:0)Mountain Standard Time-America/Denver",
  "America/Phoenix": "Client: (GMT-7:0)US Mountain Standard Time-America/Phoenix",
  "America/Chicago": "Client: (GMT-6:0)Central Standard Time-America/Chicago",
  "America/New_York": "Client: (GMT-5:0)Eastern Standard Time-America/New_York",
  "America/Indianapolis": "Client: (GMT-5:0)US Eastern Standard Time-America/Indianapolis",
  "America/Halifax": "Client: (GMT-4:0)Atlantic Standard Time-America/Halifax",
  "America/St_Johns": "Client: (GMT-3:30)Newfoundland Standard Time-America/St_Johns",
  "America/Sao_Paulo": "Client: (GMT-3:0)E. South America Standard Time-America/Sao_Paulo",
  "Atlantic/South_Georgia": "Client: (GMT-2:0)Mid-Atlantic Standard Time-Atlantic/South_Georgia",
  "Atlantic/Azores": "Client: (GMT-1:0)Azores Standard Time-Atlantic/Azores",
  "UTC": "Client: (GMT+0:0)GMT Standard Time-UTC",
  "Europe/London": "Client: (GMT+0:0)GMT Standard Time-Europe/London",
  "Europe/Paris": "Client: (GMT+1:0)Romance Standard Time-Europe/Paris",
  "Europe/Berlin": "Client: (GMT+1:0)W. Europe Standard Time-Europe/Berlin",
  "Europe/Helsinki": "Client: (GMT+2:0)FLE Standard Time-Europe/Helsinki",
  "Europe/Moscow": "Client: (GMT+3:0)Russian Standard Time-Europe/Moscow",
  "Asia/Dubai": "Client: (GMT+4:0)Arabian Standard Time-Asia/Dubai",
  "Asia/Kolkata": "Client: (GMT+5:30)India Standard Time-Asia/Kolkata",
  "Asia/Dhaka": "Client: (GMT+6:0)Central Asia Standard Time-Asia/Dhaka",
  "Asia/Bangkok": "Client: (GMT+7:0)SE Asia Standard Time-Asia/Bangkok",
  "Asia/Shanghai": "Client: (GMT+8:0)China Standard Time-Asia/Shanghai",
  "Asia/Singapore": "Client: (GMT+8:0)Singapore Standard Time-Asia/Singapore",
  "Asia/Tokyo": "Client: (GMT+9:0)Tokyo Standard Time-Asia/Tokyo",
  "Australia/Sydney": "Client: (GMT+10:0)AUS Eastern Standard Time-Australia/Sydney",
  "Pacific/Auckland": "Client: (GMT+12:0)New Zealand Standard Time-Pacific/Auckland",
};

function parseDuration(str) {
  const match = str.match(DURATION_RE);
  if (!match) {
    throw new Error(`Invalid duration "${str}". Expected format: <number><m|h|d> (e.g., 30m, 2h, 1d)`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * multipliers[unit];
}

function parseTimeArg(str) {
  if (str === "now") {
    return new Date();
  }
  // Try parsing as date string
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new Error(`Cannot parse "${str}" as a date. Use ISO 8601 (2026-03-19T08:00:00), "2026-03-19 08:00", or "now".`);
  }
  return date;
}

function toCiscoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  const hoursStr = String(hours).padStart(2, "0");
  return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
}

function resolveTimeRange(opts) {
  if (opts.last && (opts.from || opts.to)) {
    throw new Error("--last and --from/--to are mutually exclusive. Use one or the other.");
  }

  if (opts.last) {
    const duration = parseDuration(opts.last);
    const to = new Date();
    const from = new Date(to.getTime() - duration);
    return { from, to };
  }

  if (opts.from) {
    const from = parseTimeArg(opts.from);
    const to = opts.to ? parseTimeArg(opts.to) : new Date();
    return { from, to };
  }

  throw new Error("A time range is required. Use --last <duration> or --from <date> [--to <date>].");
}

function getSystemTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function toCiscoTimezone(iana) {
  if (CISCO_TIMEZONES[iana]) {
    return CISCO_TIMEZONES[iana];
  }
  throw new Error(
    `Unknown timezone "${iana}". Supported timezones:\n` +
    Object.keys(CISCO_TIMEZONES).join(", ")
  );
}

module.exports = {
  parseDuration,
  parseTimeArg,
  toCiscoDate,
  resolveTimeRange,
  getSystemTimezone,
  toCiscoTimezone,
  CISCO_TIMEZONES,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/time.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/utils/time.js test/cli/time.test.js
git commit -m "feat(cli): add time parser with Cisco date/timezone format conversion"
```

---

## Task 5: Cache Utility (`cli/utils/cache.js`)

**Files:**
- Create: `cli/utils/cache.js`
- Create: `test/cli/cache.test.js`

- [ ] **Step 1: Write failing tests for cache utility**

Create `test/cli/cache.test.js`:

```js
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
    const loaded = cacheModule.loadSelectResults();
    assert.deepEqual(loaded, files);
  });

  it("loadSelectResults returns null when no cache", () => {
    const loaded = cacheModule.loadSelectResults();
    assert.equal(loaded, null);
  });

  it("parseIndices handles comma-separated", () => {
    const result = cacheModule.parseIndices("1,3,5");
    assert.deepEqual(result, [1, 3, 5]);
  });

  it("parseIndices handles range", () => {
    const result = cacheModule.parseIndices("1-5");
    assert.deepEqual(result, [1, 2, 3, 4, 5]);
  });

  it("parseIndices handles mixed", () => {
    const result = cacheModule.parseIndices("1,3-5,8");
    assert.deepEqual(result, [1, 3, 4, 5, 8]);
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
    const files = [{ index: 1, filename: "/path/a.gz", host: "h1" }];
    cacheModule.saveSelectResults(files);
    assert.throws(() => cacheModule.resolveFiles("5"), /Index 5 not found/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/cache.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement cache utility**

Create `cli/utils/cache.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("./config.js");

function getCachePath() {
  return path.join(getConfigDir(), "last-select.json");
}

function saveSelectResults(files) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(getCachePath(), JSON.stringify(files, null, 2));
}

function loadSelectResults() {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
}

function parseIndices(str) {
  const indices = [];
  const parts = str.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) {
        indices.push(i);
      }
    } else {
      indices.push(parseInt(trimmed, 10));
    }
  }
  return indices;
}

function resolveFiles(indexStr) {
  const cached = loadSelectResults();
  if (!cached) {
    throw new Error('No cached select results. Run "cisco-dime select" first.');
  }
  const indices = parseIndices(indexStr);
  const files = [];
  for (const idx of indices) {
    const file = cached.find((f) => f.index === idx);
    if (!file) {
      throw new Error(`Index ${idx} not found in cached results. Run "cisco-dime select" to refresh.`);
    }
    files.push(file);
  }
  return files;
}

module.exports = {
  saveSelectResults,
  loadSelectResults,
  parseIndices,
  resolveFiles,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/cache.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/utils/cache.js test/cli/cache.test.js
git commit -m "feat(cli): add select results cache with index parsing"
```

---

## Task 6: Decompress Utility (`cli/utils/decompress.js`)

**Files:**
- Create: `cli/utils/decompress.js`
- Create: `test/cli/decompress.test.js`

- [ ] **Step 1: Write failing tests for decompress utility**

Create `test/cli/decompress.test.js`:

```js
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
    // Truncate the buffer to simulate an in-progress write
    const truncated = compressed.subarray(0, compressed.length - 5);
    const result = decompress.tryDecompress(truncated, "test.txt.gz");
    assert.equal(result.success, false);
    assert.ok(result.warning.includes("truncated"));
  });

  it("strips .gz extension for output name", () => {
    assert.equal(decompress.stripGzExtension("file.txt.gz"), "file.txt");
    assert.equal(decompress.stripGzExtension("file.log.gz"), "file.log");
    assert.equal(decompress.stripGzExtension("file.txt"), "file.txt");
  });

  it("isGzFile detects .gz extension", () => {
    assert.equal(decompress.isGzFile("file.gz"), true);
    assert.equal(decompress.isGzFile("file.txt.gz"), true);
    assert.equal(decompress.isGzFile("file.txt"), false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/decompress.test.js
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement decompress utility**

Create `cli/utils/decompress.js`:

```js
const { gunzipSync } = require("node:zlib");

function isGzFile(filename) {
  return filename.endsWith(".gz");
}

function stripGzExtension(filename) {
  if (filename.endsWith(".gz")) {
    return filename.slice(0, -3);
  }
  return filename;
}

function tryDecompress(buffer, filename) {
  try {
    const data = gunzipSync(buffer);
    return {
      success: true,
      data,
      outputName: stripGzExtension(filename),
    };
  } catch (err) {
    return {
      success: false,
      data: buffer,
      outputName: filename,
      warning: `File "${filename}" appears truncated (may still be written to). Saved as-is without decompression.`,
    };
  }
}

module.exports = {
  isGzFile,
  stripGzExtension,
  tryDecompress,
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test test/cli/decompress.test.js
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/utils/decompress.js test/cli/decompress.test.js
git commit -m "feat(cli): add decompression utility with truncation detection"
```

---

## Task 7: Audit Utility (`cli/utils/audit.js`)

**Files:**
- Create: `cli/utils/audit.js`

- [ ] **Step 1: Implement audit utility**

Create `cli/utils/audit.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("./config.js");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getAuditPath() {
  return path.join(getConfigDir(), "audit.jsonl");
}

function rotateIfNeeded(auditPath) {
  try {
    const stats = fs.statSync(auditPath);
    if (stats.size >= MAX_FILE_SIZE) {
      const rotated = auditPath + ".1";
      if (fs.existsSync(rotated)) {
        fs.unlinkSync(rotated);
      }
      fs.renameSync(auditPath, rotated);
    }
  } catch {
    // File doesn't exist yet — no rotation needed
  }
}

function log(entry) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const auditPath = getAuditPath();
  rotateIfNeeded(auditPath);
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...entry,
  }) + "\n";
  fs.appendFileSync(auditPath, line);
}

module.exports = { log };
```

- [ ] **Step 2: Commit**

```bash
git add cli/utils/audit.js
git commit -m "feat(cli): add JSONL audit trail with rotation"
```

---

## Task 8: Output Formatters

**Files:**
- Create: `cli/utils/output.js`
- Create: `cli/formatters/table.js`
- Create: `cli/formatters/json.js`
- Create: `cli/formatters/toon.js`
- Create: `cli/formatters/csv.js`
- Create: `test/cli/formatters.test.js`

- [ ] **Step 1: Write failing tests for formatters**

Create `test/cli/formatters.test.js`:

```js
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
    const parsed = JSON.parse(out);
    assert.equal(parsed.server, "cucm-pub.lab.local");
  });
});

describe("csv formatter", () => {
  it("formats a list as CSV with headers", () => {
    const out = formatCsv(sampleList);
    const lines = out.trim().split("\n");
    assert.equal(lines[0], "index,filename,size,modified,host");
    assert.equal(lines.length, 3); // header + 2 rows
  });

  it("formats a single item as CSV", () => {
    const out = formatCsv(sampleItem);
    const lines = out.trim().split("\n");
    assert.equal(lines.length, 2); // header + 1 row
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
node --test test/cli/formatters.test.js
```

Expected: FAIL — modules not found

- [ ] **Step 3: Implement JSON formatter**

Create `cli/formatters/json.js`:

```js
function formatJson(data) {
  return JSON.stringify(data, null, 2);
}

module.exports = formatJson;
```

- [ ] **Step 4: Implement CSV formatter**

Create `cli/formatters/csv.js`:

```js
const { stringify } = require("csv-stringify/sync");

function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  return stringify(rows, { header: true, columns });
}

module.exports = formatCsv;
```

- [ ] **Step 5: Implement table formatter**

Create `cli/formatters/table.js`:

```js
const Table = require("cli-table3");

function formatTable(data) {
  if (Array.isArray(data)) {
    return formatListTable(data);
  }
  return formatItemTable(data);
}

function formatListTable(rows) {
  if (rows.length === 0) return "No results found";
  const columns = Object.keys(rows[0]);
  const table = new Table({ head: columns });
  for (const row of rows) {
    table.push(columns.map((col) => String(row[col] ?? "")));
  }
  return `${table.toString()}\n${rows.length} result${rows.length !== 1 ? "s" : ""} found`;
}

function formatItemTable(item) {
  const table = new Table();
  for (const [key, value] of Object.entries(item)) {
    const displayValue = typeof value === "object" && value !== null
      ? JSON.stringify(value, null, 2)
      : String(value ?? "");
    table.push({ [key]: displayValue });
  }
  return table.toString();
}

module.exports = formatTable;
```

- [ ] **Step 6: Implement TOON formatter**

Create `cli/formatters/toon.js`:

```js
async function formatToon(data) {
  const { encode } = await import("@toon-format/toon");
  return encode(data);
}

module.exports = formatToon;
```

Note: `@toon-format/toon` is ESM-only. We use `await import()` to bridge from CJS.

- [ ] **Step 7: Implement output utility**

Create `cli/utils/output.js`:

```js
const formatTable = require("../formatters/table.js");
const formatJson = require("../formatters/json.js");
const formatToon = require("../formatters/toon.js");
const formatCsv = require("../formatters/csv.js");

const formatters = {
  table: formatTable,
  json: formatJson,
  toon: formatToon,
  csv: formatCsv,
};

async function printResult(data, format) {
  const formatter = formatters[format || "table"];
  if (!formatter) {
    throw new Error(`Unknown format "${format}". Valid: table, json, toon, csv`);
  }
  const output = await Promise.resolve(formatter(data));
  console.log(output);
}

function printError(err) {
  const message = err.message || String(err);
  process.stderr.write(`Error: ${message}\n`);

  if (message.includes("Authentication failed") || (err.name === "DimeAuthError")) {
    process.stderr.write('Hint: Run "cisco-dime config test" to verify your credentials.\n');
  } else if (message.includes("not found") && message.includes("Preset")) {
    process.stderr.write('Hint: Run "cisco-dime config list-presets" to see available presets.\n');
  }

  process.exitCode = 1;
}

module.exports = { printResult, printError };
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
node --test test/cli/formatters.test.js
```

Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add cli/formatters/ cli/utils/output.js test/cli/formatters.test.js
git commit -m "feat(cli): add output formatters (table, json, toon, csv)"
```

---

## Task 9: CLI Entry Point & Commander Setup

**Files:**
- Create: `bin/cisco-dime.js`
- Create: `cli/index.js`

- [ ] **Step 1: Create bin entry point**

Create `bin/cisco-dime.js`:

```js
#!/usr/bin/env node
require("../cli/index.js");
```

- [ ] **Step 2: Make bin executable**

```bash
chmod +x bin/cisco-dime.js
```

- [ ] **Step 3: Create Commander program setup**

Create `cli/index.js`:

```js
const { Command } = require("commander");
const { version } = require("../package.json");

const program = new Command();

program
  .name("cisco-dime")
  .description("CLI for downloading log files from Cisco UC products via DIME")
  .version(version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "CUCM hostname (overrides config/env)")
  .option("--username <user>", "CUCM username (overrides config/env)")
  .option("--password <pass>", "CUCM password (overrides config/env)")
  .option("--cluster <name>", "use a specific named cluster")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--concurrency <n>", "parallel operations", "5")
  .option("--debug", "enable debug logging");

// Register commands
require("./commands/config.js")(program);
require("./commands/list-services.js")(program);
require("./commands/select.js")(program);
require("./commands/download.js")(program);

program.parse();
```

- [ ] **Step 4: Test the entry point runs**

```bash
node bin/cisco-dime.js --help
```

Expected: Shows help output (will fail until commands are created — that's OK for now, we'll verify after Task 10)

- [ ] **Step 5: Commit**

```bash
git add bin/cisco-dime.js cli/index.js
git commit -m "feat(cli): add CLI entry point and Commander program setup"
```

---

## Task 10: Config Command (`cli/commands/config.js`)

**Files:**
- Create: `cli/commands/config.js`

- [ ] **Step 1: Implement config command**

Create `cli/commands/config.js`:

```js
const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function (program) {
  const config = program.command("config").description("Manage CUCM cluster configurations and presets");

  config
    .command("add <name>")
    .description("Add a CUCM cluster")
    .requiredOption("--host <host>", "CUCM hostname or IP")
    .requiredOption("--username <user>", "CUCM username")
    .requiredOption("--password <pass>", "CUCM password")
    .option("--insecure", "skip TLS verification for this cluster")
    .action((name, opts) => {
      try {
        configUtil.addCluster(name, opts);
        console.log(`Cluster "${name}" added successfully.`);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("use <name>")
    .description("Set the active cluster")
    .action((name) => {
      try {
        configUtil.useCluster(name);
        console.log(`Active cluster set to "${name}".`);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("list")
    .description("List all configured clusters")
    .action(async () => {
      try {
        const { activeCluster, clusters } = configUtil.listClusters();
        const rows = Object.entries(clusters).map(([name, c]) => ({
          name,
          active: name === activeCluster ? "*" : "",
          host: c.host,
          username: c.username,
        }));
        if (rows.length === 0) {
          console.log("No clusters configured. Run: cisco-dime config add <name> ...");
          return;
        }
        await printResult(rows, program.opts().format);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("show")
    .description("Show active cluster details (masks passwords)")
    .action(async () => {
      try {
        const cluster = configUtil.getActiveCluster(program.opts().cluster);
        if (!cluster) {
          console.log("No active cluster. Run: cisco-dime config add <name> ...");
          return;
        }
        const display = {
          ...cluster,
          password: configUtil.maskPassword(cluster.password),
        };
        await printResult(display, program.opts().format);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("remove <name>")
    .description("Remove a cluster")
    .action((name) => {
      try {
        configUtil.removeCluster(name);
        console.log(`Cluster "${name}" removed.`);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("test")
    .description("Test connection to the active cluster")
    .action(async () => {
      try {
        const globalOpts = program.opts();
        const { resolveConfig } = require("../utils/connection.js");
        const connConfig = resolveConfig(globalOpts);
        const dime = require("../../main.js");

        if (connConfig.insecure) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        const result = await dime.listNodeServiceLogs(
          connConfig.host,
          connConfig.username,
          connConfig.password
        );
        const nodes = Array.isArray(result) ? result : [result];
        const totalServices = nodes.reduce((sum, n) => sum + n.count, 0);
        console.log(`Connection successful. Found ${nodes.length} node(s) with ${totalServices} service log(s).`);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("add-preset <name>")
    .description("Add a custom log preset")
    .requiredOption("--services <services>", "comma-separated service log names")
    .action((name, opts) => {
      try {
        const services = opts.services.split(",").map((s) => s.trim());
        configUtil.addPreset(name, services);
        console.log(`Preset "${name}" added with ${services.length} service(s).`);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("list-presets")
    .description("List all presets (built-in and custom)")
    .action(async () => {
      try {
        const presets = configUtil.listPresets();
        const rows = presets.map((p) => ({
          name: p.name,
          type: p.builtIn ? "built-in" : "custom",
          services: p.services.join(", "),
        }));
        await printResult(rows, program.opts().format);
      } catch (err) {
        printError(err);
      }
    });

  config
    .command("remove-preset <name>")
    .description("Remove a custom preset")
    .action((name) => {
      try {
        configUtil.removePreset(name);
        console.log(`Preset "${name}" removed.`);
      } catch (err) {
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Test config commands manually**

```bash
node bin/cisco-dime.js config add lab --host 10.0.0.1 --username admin --password test
node bin/cisco-dime.js config list
node bin/cisco-dime.js config show
node bin/cisco-dime.js config add-preset my-logs --services "Service A,Service B"
node bin/cisco-dime.js config list-presets
node bin/cisco-dime.js config remove-preset my-logs
node bin/cisco-dime.js config remove lab
```

Expected: Each command works, config file created at `~/.cisco-dime/config.json`

- [ ] **Step 3: Commit**

```bash
git add cli/commands/config.js
git commit -m "feat(cli): add config command (add/use/list/show/remove/test/presets)"
```

---

## Task 11: List Services Command (`cli/commands/list-services.js`)

**Files:**
- Create: `cli/commands/list-services.js`

- [ ] **Step 1: Implement list-services command**

Create `cli/commands/list-services.js`:

```js
const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const audit = require("../utils/audit.js");

module.exports = function (program) {
  program
    .command("list-services")
    .description("List available service logs on the cluster")
    .action(async () => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        const dime = require("../../main.js");

        if (connConfig.insecure) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        if (globalOpts.debug) {
          process.env.DEBUG = "cisco-dime";
        }

        const result = await dime.listNodeServiceLogs(
          connConfig.host,
          connConfig.username,
          connConfig.password
        );

        const nodes = Array.isArray(result) ? result : [result];

        if (globalOpts.format === "table") {
          // Hierarchical display for table mode
          for (const node of nodes) {
            console.log(`Node: ${node.server}`);
            for (const svc of node.servicelogs) {
              console.log(`  - ${svc}`);
            }
          }
          console.log(`\n${nodes.length} node(s) found`);
        } else {
          await printResult(nodes, globalOpts.format);
        }

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host,
            command: "list-services",
            duration_ms: Date.now() - start,
            status: "success",
            nodes: nodes.length,
          });
        }
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({
            command: "list-services",
            duration_ms: Date.now() - start,
            status: "error",
            error: err.message,
          });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Test manually (requires CUCM or env vars)**

```bash
node bin/cisco-dime.js list-services --help
```

Expected: Shows help output for list-services command

- [ ] **Step 3: Commit**

```bash
git add cli/commands/list-services.js
git commit -m "feat(cli): add list-services command"
```

---

## Task 12: Select Command (`cli/commands/select.js`)

**Files:**
- Create: `cli/commands/select.js`

- [ ] **Step 1: Implement select command**

Create `cli/commands/select.js`:

```js
const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const configUtil = require("../utils/config.js");
const timeUtil = require("../utils/time.js");
const cache = require("../utils/cache.js");
const audit = require("../utils/audit.js");
const fs = require("node:fs");
const path = require("node:path");

module.exports = function (program) {
  program
    .command("select <serviceOrPreset>")
    .description("Select log files by service name or preset")
    .option("--last <duration>", "relative time range (e.g., 30m, 2h, 1d)")
    .option("--from <datetime>", "start date/time")
    .option("--to <datetime>", "end date/time (default: now)")
    .option("--timezone <tz>", "IANA timezone name (default: system timezone)")
    .option("--all-nodes", "query all nodes in the cluster")
    .option("--hosts <hosts>", "comma-separated list of hosts to query")
    .option("--download", "download all matched files immediately")
    .option("--output-dir <dir>", "directory to save downloaded files")
    .option("--organize", "organize downloads into host/date subdirectories")
    .option("--decompress", "decompress .gz files after download")
    .action(async (serviceOrPreset, cmdOpts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        const dime = require("../../main.js");

        if (connConfig.insecure) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        if (globalOpts.debug) {
          process.env.DEBUG = "cisco-dime";
        }

        // Resolve preset or use as service name
        const preset = configUtil.getPreset(serviceOrPreset);
        const services = preset ? preset.services : [serviceOrPreset];

        // Resolve time range
        const { from, to } = timeUtil.resolveTimeRange(cmdOpts);
        const fromStr = timeUtil.toCiscoDate(from);
        const toStr = timeUtil.toCiscoDate(to);

        // Resolve timezone
        const tzIana = cmdOpts.timezone || timeUtil.getSystemTimezone();
        const tzCisco = timeUtil.toCiscoTimezone(tzIana);

        // Resolve hosts
        let hosts = [connConfig.host];
        if (cmdOpts.allNodes) {
          const nodeResult = await dime.listNodeServiceLogs(
            connConfig.host,
            connConfig.username,
            connConfig.password
          );
          const nodes = Array.isArray(nodeResult) ? nodeResult : [nodeResult];
          hosts = nodes.map((n) => n.server);
        } else if (cmdOpts.hosts) {
          hosts = cmdOpts.hosts.split(",").map((h) => h.trim());
        }

        // Execute selectLogFiles for each service x host combination
        const allFiles = [];
        const concurrency = parseInt(globalOpts.concurrency, 10) || 5;

        for (const service of services) {
          let files;
          if (hosts.length === 1) {
            files = await dime.selectLogFiles(
              hosts[0], connConfig.username, connConfig.password,
              service, fromStr, toStr, tzCisco
            );
          } else {
            files = await dime.selectLogFilesMulti(
              hosts, connConfig.username, connConfig.password,
              service, fromStr, toStr, tzCisco,
              { concurrency }
            );
          }
          if (Array.isArray(files)) {
            allFiles.push(...files);
          }
        }

        // Add index to each file
        const indexed = allFiles.map((f, i) => ({
          index: i + 1,
          filename: f.absolutepath || f.name || "",
          size: f.filesize || "",
          modified: f.modifiedDate || "",
          host: f.server || connConfig.host,
        }));

        // Cache results
        cache.saveSelectResults(indexed);

        // Display results
        if (indexed.length === 0) {
          console.log("No log files found matching the criteria.");
        } else {
          await printResult(indexed, globalOpts.format);
        }

        if (globalOpts.audit !== false) {
          audit.log({
            cluster: connConfig.host,
            command: "select",
            args: serviceOrPreset,
            duration_ms: Date.now() - start,
            status: "success",
            files: indexed.length,
          });
        }

        // Handle --download
        if (cmdOpts.download && indexed.length > 0) {
          const downloadCmd = require("./download.js");
          await downloadCmd.downloadFiles(indexed, connConfig, {
            outputDir: cmdOpts.outputDir,
            organize: cmdOpts.organize,
            decompress: cmdOpts.decompress,
            concurrency,
            format: globalOpts.format,
            noAudit: globalOpts.audit === false,
          });
        }
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({
            command: "select",
            args: serviceOrPreset,
            duration_ms: Date.now() - start,
            status: "error",
            error: err.message,
          });
        }
        printError(err);
      }
    });
};
```

- [ ] **Step 2: Test manually**

```bash
node bin/cisco-dime.js select --help
```

Expected: Shows help output for select command

- [ ] **Step 3: Commit**

```bash
git add cli/commands/select.js
git commit -m "feat(cli): add select command with presets, time parsing, and multi-host support"
```

---

## Task 13: Download Command (`cli/commands/download.js`)

**Files:**
- Create: `cli/commands/download.js`

- [ ] **Step 1: Implement download command**

Create `cli/commands/download.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { Writable } = require("node:stream");
const { resolveConfig } = require("../utils/connection.js");
const { printError } = require("../utils/output.js");
const cache = require("../utils/cache.js");
const audit = require("../utils/audit.js");
const decompressUtil = require("../utils/decompress.js");

const STREAM_THRESHOLD = 50 * 1024 * 1024; // 50MB

function parseSizeToBytes(sizeStr) {
  if (!sizeStr || typeof sizeStr !== "string") return 0;
  const num = parseFloat(sizeStr);
  if (isNaN(num)) return 0;
  const lower = sizeStr.toLowerCase();
  if (lower.includes("gb")) return num * 1024 * 1024 * 1024;
  if (lower.includes("mb")) return num * 1024 * 1024;
  if (lower.includes("kb")) return num * 1024;
  return num;
}

function getSavePath(file, outputDir, organize) {
  const basename = path.basename(file.filename);
  if (organize) {
    // Use the file's modification date, fall back to current date
    let dateStr;
    if (file.modified) {
      const parsed = new Date(file.modified);
      dateStr = isNaN(parsed.getTime())
        ? new Date().toISOString().split("T")[0]
        : parsed.toISOString().split("T")[0];
    } else {
      dateStr = new Date().toISOString().split("T")[0];
    }
    const subdir = path.join(outputDir, file.host, dateStr);
    fs.mkdirSync(subdir, { recursive: true });
    return path.join(subdir, basename);
  }
  fs.mkdirSync(outputDir, { recursive: true });
  return path.join(outputDir, basename);
}

async function downloadOneStreaming(dime, host, username, password, file, savePath) {
  const streamResult = await dime.getOneFileStream(host, username, password, file.filename);
  const writeStream = fs.createWriteStream(savePath);
  let bytesWritten = 0;
  const passthrough = new Writable({
    write(chunk, encoding, callback) {
      bytesWritten += chunk.length;
      if (streamResult.contentLength) {
        const pct = Math.round((bytesWritten / streamResult.contentLength) * 100);
        process.stderr.write(`\r  Streaming ${path.basename(file.filename)}... ${pct}%`);
      }
      writeStream.write(chunk, encoding, callback);
    },
    final(callback) {
      writeStream.end(callback);
    },
  });
  await pipeline(streamResult.body, passthrough);
  process.stderr.write("\r" + " ".repeat(60) + "\r");
  return bytesWritten;
}

async function downloadFiles(files, connConfig, opts = {}) {
  const dime = require("../../main.js");
  const outputDir = opts.outputDir || process.cwd();
  const concurrency = opts.concurrency || 5;
  let totalBytes = 0;
  let successCount = 0;
  let failCount = 0;

  // Group files by host
  const byHost = {};
  for (const file of files) {
    const host = file.host || connConfig.host;
    if (!byHost[host]) byHost[host] = [];
    byHost[host].push(file);
  }

  for (const [host, hostFiles] of Object.entries(byHost)) {
    // Separate large files (stream) from small files (buffer)
    const largeFiles = hostFiles.filter((f) => parseSizeToBytes(f.size) > STREAM_THRESHOLD);
    const smallFiles = hostFiles.filter((f) => parseSizeToBytes(f.size) <= STREAM_THRESHOLD);

    // Download large files one at a time via streaming
    for (const file of largeFiles) {
      const savePath = getSavePath(file, outputDir, opts.organize);
      try {
        const bytes = await downloadOneStreaming(
          dime, host, connConfig.username, connConfig.password, file, savePath
        );
        totalBytes += bytes;
        successCount++;
        process.stderr.write(`  OK: ${path.basename(file.filename)} (${formatBytes(bytes)}) [streamed]\n`);
      } catch (err) {
        failCount++;
        process.stderr.write(`  FAIL: ${file.filename} - ${err.message}\n`);
      }
    }

    // Download small files in batch via getMultipleFiles
    if (smallFiles.length > 0) {
      const filenames = smallFiles.map((f) => f.filename);

      await dime.getMultipleFiles(
        host,
        connConfig.username,
        connConfig.password,
        filenames,
        {
          concurrency,
          onFileComplete: (err, result, index) => {
            const file = smallFiles[index];
            if (err) {
              failCount++;
              process.stderr.write(`  FAIL: ${file.filename} - ${err.message}\n`);
            } else {
              successCount++;
              let savePath = getSavePath(file, outputDir, opts.organize);
              let data = result.data;
              let finalName = path.basename(file.filename);

              // Handle decompression
              if (opts.decompress && decompressUtil.isGzFile(finalName)) {
                const decompResult = decompressUtil.tryDecompress(data, finalName);
                if (decompResult.success) {
                  data = decompResult.data;
                  finalName = decompResult.outputName;
                  savePath = path.join(path.dirname(savePath), finalName);
                } else {
                  process.stderr.write(`  Warning: ${decompResult.warning}\n`);
                }
              }

              fs.writeFileSync(savePath, data);
              totalBytes += data.length;
              process.stderr.write(`  OK: ${finalName} (${formatBytes(data.length)})\n`);
            }
          },
        }
      );
    }
  }

  console.log(`\nDownload complete: ${successCount} succeeded, ${failCount} failed, ${formatBytes(totalBytes)} total`);

  if (!opts.noAudit) {
    audit.log({
      cluster: connConfig.host,
      command: "download",
      duration_ms: 0, // caller handles timing
      status: failCount > 0 ? "partial" : "success",
      files: successCount,
      failedFiles: failCount,
      totalBytes,
    });
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function registerCommand(program) {
  program
    .command("download [indices]")
    .description("Download files by index from last select, or by path")
    .option("--all", "download all files from last select")
    .option("--file <path>", "download a specific file by full path (requires --host)")
    .option("--output-dir <dir>", "directory to save files (default: cwd)")
    .option("--organize", "organize into host/date subdirectories")
    .option("--decompress", "decompress .gz files after download")
    .action(async (indices, cmdOpts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        const concurrency = parseInt(globalOpts.concurrency, 10) || 5;

        if (connConfig.insecure) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }

        if (globalOpts.debug) {
          process.env.DEBUG = "cisco-dime";
        }

        let files;

        if (cmdOpts.file) {
          // Direct file download
          files = [{
            index: 1,
            filename: cmdOpts.file,
            host: connConfig.host,
          }];
        } else if (cmdOpts.all) {
          const cached = cache.loadSelectResults();
          if (!cached) {
            throw new Error('No cached select results. Run "cisco-dime select" first.');
          }
          files = cached;
        } else if (indices) {
          files = cache.resolveFiles(indices);
        } else {
          throw new Error("Specify file indices (e.g., 1,3,5), --all, or --file <path>.");
        }

        await downloadFiles(files, connConfig, {
          outputDir: cmdOpts.outputDir,
          organize: cmdOpts.organize,
          decompress: cmdOpts.decompress,
          concurrency,
          format: globalOpts.format,
          noAudit: globalOpts.audit === false,
        });
      } catch (err) {
        printError(err);
      }
    });
}

module.exports = registerCommand;
module.exports.downloadFiles = downloadFiles;
```

- [ ] **Step 2: Test manually**

```bash
node bin/cisco-dime.js download --help
```

Expected: Shows help output for download command

- [ ] **Step 3: Commit**

```bash
git add cli/commands/download.js
git commit -m "feat(cli): add download command with index, batch, decompress, and organize support"
```

---

## Task 14: End-to-End Manual Testing

- [ ] **Step 1: Verify --help output**

```bash
node bin/cisco-dime.js --help
node bin/cisco-dime.js --version
node bin/cisco-dime.js config --help
node bin/cisco-dime.js select --help
node bin/cisco-dime.js download --help
node bin/cisco-dime.js list-services --help
```

Expected: All help output renders correctly with commands and options listed

- [ ] **Step 2: Test config workflow**

```bash
node bin/cisco-dime.js config add lab --host 10.0.0.1 --username admin --password test
node bin/cisco-dime.js config list
node bin/cisco-dime.js config show
node bin/cisco-dime.js config list-presets
node bin/cisco-dime.js config add-preset my-preset --services "Service A,Service B"
node bin/cisco-dime.js config list-presets
node bin/cisco-dime.js config remove-preset my-preset
node bin/cisco-dime.js config remove lab
```

Expected: Full config lifecycle works

- [ ] **Step 3: Run all unit tests**

```bash
node --test test/cli/config.test.js test/cli/connection.test.js test/cli/time.test.js test/cli/cache.test.js test/cli/decompress.test.js test/cli/formatters.test.js
```

Expected: All tests PASS

- [ ] **Step 4: Test with live CUCM (if available)**

```bash
export CUCM_HOST=<your-cucm-host>
export CUCM_USERNAME=<your-username>
export CUCM_PASSWORD=<your-password>
node bin/cisco-dime.js list-services --insecure
node bin/cisco-dime.js select sip-traces --last 30m --insecure
node bin/cisco-dime.js download 1 --insecure --output-dir ./test-downloads
```

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(cli): address issues found during e2e testing"
```

---

## Task 15: Skills.sh Skill

**Files:**
- Create: `skills/cisco-dime-cli/SKILL.md`

- [ ] **Step 1: Create skill definition**

Create `skills/cisco-dime-cli/SKILL.md`:

```markdown
---
name: cisco-dime-cli
description: Use when managing Cisco CUCM log files via the cisco-dime CLI — selecting, downloading, and listing service logs from Cisco UC products via DIME.
---

# cisco-dime CLI

CLI for downloading log files from Cisco UC products (VOS) via DIME.

## Setup

Configure a cluster (one-time):

\`\`\`bash
cisco-dime config add <name> --host <host> --username <user> --password <pass> --insecure
cisco-dime config test
\`\`\`

Or use environment variables:

\`\`\`bash
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
\`\`\`

## Discover Available Logs

\`\`\`bash
cisco-dime list-services
\`\`\`

## Built-in Presets

| Preset | Services |
|--------|----------|
| sip-traces | Cisco CallManager, Cisco CTIManager |
| cti-traces | Cisco CTIManager |
| curri-logs | Cisco Extended Functions |
| syslog | messages, CiscoSyslog |
| tomcat | Tomcat, Tomcat Security |
| oamp | Cisco Unified OS Admin, Cisco Unified CM Admin |
| audit | Cisco Audit Event Service |

## Common Workflows

### Grab SIP traces from last 30 minutes

\`\`\`bash
cisco-dime select sip-traces --last 30m --download --insecure
\`\`\`

### Select logs then download specific files

\`\`\`bash
cisco-dime select sip-traces --last 2h --insecure
cisco-dime download 1,3,5 --insecure
\`\`\`

### Query all cluster nodes

\`\`\`bash
cisco-dime select sip-traces --last 1h --all-nodes --insecure
cisco-dime download --all --organize --insecure
\`\`\`

### Select by date range

\`\`\`bash
cisco-dime select "Cisco CallManager" --from "2026-03-19 08:00" --to "2026-03-19 09:00" --timezone America/Chicago --insecure
\`\`\`

### Download and decompress

\`\`\`bash
cisco-dime download --all --decompress --output-dir ./logs --insecure
\`\`\`

## Output Formats

- `--format table` (default) — human-readable
- `--format json` — for scripting/parsing
- `--format toon` — token-efficient for AI agents (recommended)
- `--format csv` — for spreadsheets

## Key Flags

- `--insecure` — required for self-signed CUCM certs (most environments)
- `--all-nodes` — query all cluster nodes automatically
- `--last <duration>` — relative time (30m, 2h, 1d)
- `--download` — download immediately after select
- `--organize` — save files in host/date subdirectories
- `--decompress` — gunzip .gz files after download
- `--debug` — enable verbose logging
```

- [ ] **Step 2: Commit**

```bash
git add skills/cisco-dime-cli/SKILL.md
git commit -m "feat: add skills.sh skill for cisco-dime CLI"
```

---

## Task 16: Final Cleanup & Version Bump

- [ ] **Step 1: Run full test suite**

```bash
node --test test/cli/config.test.js test/cli/connection.test.js test/cli/time.test.js test/cli/cache.test.js test/cli/decompress.test.js test/cli/formatters.test.js
```

Expected: All tests PASS

- [ ] **Step 2: Verify npm link works**

```bash
npm link
cisco-dime --version
cisco-dime --help
npm unlink -g cisco-dime
```

Expected: CLI is accessible globally and shows correct version

- [ ] **Step 3: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: final cleanup before release"
```
