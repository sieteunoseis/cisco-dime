const { resolveConfig } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const configUtil = require("../utils/config.js");
const timeUtil = require("../utils/time.js");
const cache = require("../utils/cache.js");
const audit = require("../utils/audit.js");

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
    .option("--include-active", "include active log files (.gzo) that are still being written to")
    .action(async (serviceOrPreset, cmdOpts) => {
      const start = Date.now();
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        const dime = require("../../main.js");
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-dime"; }

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
          const nodeResult = await dime.listNodeServiceLogs(connConfig.host, connConfig.username, connConfig.password);
          const nodes = Array.isArray(nodeResult) ? nodeResult : [nodeResult];
          hosts = nodes.map((n) => n.server);
        } else if (cmdOpts.hosts) {
          hosts = cmdOpts.hosts.split(",").map((h) => h.trim());
        }

        // Execute selectLogFiles for each service x host
        const allFiles = [];
        const concurrency = parseInt(globalOpts.concurrency, 10) || 5;
        for (const service of services) {
          let files;
          if (hosts.length === 1) {
            files = await dime.selectLogFiles(hosts[0], connConfig.username, connConfig.password, service, fromStr, toStr, tzCisco);
          } else {
            files = await dime.selectLogFilesMulti(hosts, connConfig.username, connConfig.password, service, fromStr, toStr, tzCisco, { concurrency });
          }
          if (Array.isArray(files)) { allFiles.push(...files); }
        }

        // Filter out active (.gzo) files unless --include-active
        let filtered = allFiles;
        if (!cmdOpts.includeActive) {
          const before = allFiles.length;
          filtered = allFiles.filter((f) => {
            const name = f.absolutepath || f.name || "";
            return !name.endsWith(".gzo");
          });
          const skipped = before - filtered.length;
          if (skipped > 0) {
            process.stderr.write(`Skipped ${skipped} active log file${skipped !== 1 ? "s" : ""} (.gzo). Use --include-active to include them.\n`);
          }
        }

        // Add index to each file
        const indexed = filtered.map((f, i) => ({
          index: i + 1,
          filename: f.absolutepath || f.name || "",
          size: f.filesize || "",
          modified: f.modifiedDate || "",
          host: f.server || connConfig.host,
        }));

        cache.saveSelectResults(indexed);

        if (indexed.length === 0) {
          console.log("No log files found matching the criteria.");
        } else {
          await printResult(indexed, globalOpts.format);
        }

        if (globalOpts.audit !== false) {
          audit.log({ cluster: connConfig.host, command: "select", args: serviceOrPreset, duration_ms: Date.now() - start, status: "success", files: indexed.length });
        }

        // Handle --download
        if (cmdOpts.download && indexed.length > 0) {
          const { downloadFiles } = require("./download.js");
          await downloadFiles(indexed, connConfig, {
            outputDir: cmdOpts.outputDir, organize: cmdOpts.organize, decompress: cmdOpts.decompress,
            concurrency, format: globalOpts.format, noAudit: globalOpts.audit === false,
          });
        }
      } catch (err) {
        if (program.opts().audit !== false) {
          audit.log({ command: "select", args: serviceOrPreset, duration_ms: Date.now() - start, status: "error", error: err.message });
        }
        printError(err);
      }
    });
};
