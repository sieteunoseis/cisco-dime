const config = require("../utils/config.js");
const { resolveConfig } = require("../utils/connection.js");

module.exports = function (program) {
  program.command("doctor")
    .description("Check DIME connectivity and configuration health")
    .action(async (opts, command) => {
      const globalOpts = command.optsWithGlobals();
      let passed = 0;
      let warned = 0;
      let failed = 0;

      const ok = (msg) => { console.log(`  ✓ ${msg}`); passed++; };
      const warn = (msg) => { console.log(`  ⚠ ${msg}`); warned++; };
      const fail = (msg) => { console.log(`  ✗ ${msg}`); failed++; };

      console.log("\n  cisco-dime doctor");
      console.log("  " + "─".repeat(50));

      // 1. Configuration
      console.log("\n  Configuration");
      let conn;
      try {
        const data = config.loadConfig();
        if (!data.activeCluster) {
          fail("No active cluster configured");
          console.log("    Run: cisco-dime config add <name> --host <host> --username <user> --password <pass>");
          printSummary(passed, warned, failed);
          return;
        }
        ok(`Active cluster: ${data.activeCluster}`);
        const cluster = data.clusters[data.activeCluster];
        ok(`Host: ${cluster.host}`);
        ok(`Username: ${cluster.username}`);

        if (cluster.insecure) warn("TLS verification: disabled (--insecure)");
        else ok("TLS verification: enabled");

        // Check presets
        const customPresets = Object.keys(data.presets || {});
        if (customPresets.length > 0) ok(`Custom presets: ${customPresets.join(", ")}`);

        conn = resolveConfig(globalOpts);
      } catch (err) {
        fail(`Config error: ${err.message}`);
        printSummary(passed, warned, failed);
        return;
      }

      // 2. DIME API connectivity
      console.log("\n  DIME API");
      try {
        if (conn.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        const { listNodeServiceLogs, setCookie } = require("../../main.js");

        const result = await listNodeServiceLogs(conn.host, conn.username, conn.password);
        const nodes = Array.isArray(result) ? result : [result];
        ok(`DIME API: connected`);
        ok(`Nodes: ${nodes.length} found`);

        let totalServices = 0;
        for (const node of nodes) {
          const name = node?.server || node?.name || "unknown";
          const services = node?.servicelogs || node?.serviceList?.service || [];
          const count = Array.isArray(services) ? services.length : 0;
          totalServices += count;
          ok(`  ${name}: ${count} service logs`);
        }
        ok(`Total service logs: ${totalServices}`);
      } catch (err) {
        const msg = err.message || String(err);
        if (msg.includes("401") || msg.includes("Authentication")) {
          fail("DIME API: authentication failed — check username/password");
        } else if (msg.includes("ECONNREFUSED")) {
          fail("DIME API: connection refused — check host and port");
        } else if (msg.includes("ENOTFOUND")) {
          fail("DIME API: hostname not found — check host");
        } else if (msg.includes("certificate")) {
          fail("DIME API: TLS certificate error — try adding --insecure to the cluster config");
        } else {
          fail(`DIME API: ${msg}`);
        }
      }

      // 3. Security
      console.log("\n  Security");
      try {
        const fs = require("node:fs");
        const configPath = config.getConfigPath();
        const stats = fs.statSync(configPath);
        const mode = (stats.mode & 0o777).toString(8);
        if (mode === "600") ok(`Config file permissions: ${mode} (secure)`);
        else warn(`Config file permissions: ${mode} — should be 600. Run: chmod 600 ${configPath}`);
      } catch { /* config file may not exist yet */ }

      // 4. Audit trail
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const auditPath = path.join(config.getConfigDir(), "audit.jsonl");
        if (fs.existsSync(auditPath)) {
          const stats = fs.statSync(auditPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
          ok(`Audit trail: ${sizeMB}MB`);
          if (stats.size > 8 * 1024 * 1024) warn("Audit trail approaching 10MB rotation limit");
        } else {
          ok("Audit trail: empty (no operations logged yet)");
        }
      } catch { /* ignore */ }

      // 5. Cache
      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const cachePath = path.join(config.getConfigDir(), "last-select.json");
        if (fs.existsSync(cachePath)) {
          const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
          const count = cache.files ? cache.files.length : 0;
          ok(`Select cache: ${count} file(s) from last select`);
        } else {
          ok("Select cache: empty");
        }
      } catch { /* ignore */ }

      printSummary(passed, warned, failed);
    });

  function printSummary(passed, warned, failed) {
    console.log("\n  " + "─".repeat(50));
    console.log(`  Results: ${passed} passed, ${warned} warning${warned !== 1 ? "s" : ""}, ${failed} failed`);
    if (failed > 0) {
      process.exitCode = 1;
      console.log("  Status:  issues found — review failures above");
    } else if (warned > 0) {
      console.log("  Status:  healthy with warnings");
    } else {
      console.log("  Status:  all systems healthy");
    }
    console.log("");
  }
};
