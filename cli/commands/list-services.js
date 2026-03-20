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
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-dime"; }

        const result = await dime.listNodeServiceLogs(connConfig.host, connConfig.username, connConfig.password);
        const nodes = Array.isArray(result) ? result : [result];

        if (globalOpts.format === "table") {
          for (const node of nodes) {
            console.log(`Node: ${node.server}`);
            for (const svc of node.servicelogs) { console.log(`  - ${svc}`); }
          }
          console.log(`\n${nodes.length} node(s) found`);
        } else {
          await printResult(nodes, globalOpts.format);
        }

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "list-services", duration_ms: Date.now() - start, status: "success", nodes: nodes.length });
        }
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "list-services", duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
