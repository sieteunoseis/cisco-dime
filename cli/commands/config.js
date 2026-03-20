const configUtil = require("../utils/config.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function (program) {
  const config = program.command("config").description("Manage CUCM cluster configurations and presets").passThroughOptions();

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
      } catch (err) { printError(err); }
    });

  config
    .command("use <name>")
    .description("Set the active cluster")
    .action((name) => {
      try { configUtil.useCluster(name); console.log(`Active cluster set to "${name}".`); }
      catch (err) { printError(err); }
    });

  config
    .command("list")
    .description("List all configured clusters")
    .action(async () => {
      try {
        const { activeCluster, clusters } = configUtil.listClusters();
        const rows = Object.entries(clusters).map(([name, c]) => ({
          name, active: name === activeCluster ? "*" : "", host: c.host, username: c.username,
        }));
        if (rows.length === 0) { console.log("No clusters configured. Run: cisco-dime config add <name> ..."); return; }
        await printResult(rows, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("show")
    .description("Show active cluster details (masks passwords)")
    .action(async () => {
      try {
        const cluster = configUtil.getActiveCluster(program.opts().cluster);
        if (!cluster) { console.log("No active cluster. Run: cisco-dime config add <name> ..."); return; }
        await printResult({ ...cluster, password: configUtil.maskPassword(cluster.password) }, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("remove <name>")
    .description("Remove a cluster")
    .action((name) => {
      try { configUtil.removeCluster(name); console.log(`Cluster "${name}" removed.`); }
      catch (err) { printError(err); }
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
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        const result = await dime.listNodeServiceLogs(connConfig.host, connConfig.username, connConfig.password);
        const nodes = Array.isArray(result) ? result : [result];
        const totalServices = nodes.reduce((sum, n) => sum + n.count, 0);
        console.log(`Connection successful. Found ${nodes.length} node(s) with ${totalServices} service log(s).`);
      } catch (err) { printError(err); }
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
      } catch (err) { printError(err); }
    });

  config
    .command("list-presets")
    .description("List all presets (built-in and custom)")
    .action(async () => {
      try {
        const presets = configUtil.listPresets();
        const rows = presets.map((p) => ({ name: p.name, type: p.builtIn ? "built-in" : "custom", services: p.services.join(", ") }));
        await printResult(rows, program.opts().format);
      } catch (err) { printError(err); }
    });

  config
    .command("remove-preset <name>")
    .description("Remove a custom preset")
    .action((name) => {
      try { configUtil.removePreset(name); console.log(`Preset "${name}" removed.`); }
      catch (err) { printError(err); }
    });
};
