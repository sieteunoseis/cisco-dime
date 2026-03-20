const { Command } = require("commander");
const pkg = require("../package.json");

import("update-notifier").then(({ default: updateNotifier }) => {
  updateNotifier({ pkg }).notify();
}).catch(() => {});

const program = new Command();

program
  .name("cisco-dime")
  .description("CLI for downloading log files from Cisco UC products via DIME")
  .version(pkg.version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "CUCM hostname (overrides config/env)")
  .option("--username <user>", "CUCM username (overrides config/env)")
  .option("--password <pass>", "CUCM password (overrides config/env)")
  .option("--cluster <name>", "use a specific named cluster")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--concurrency <n>", "parallel operations", "5")
  .option("--debug", "enable debug logging");

require("./commands/config.js")(program);
require("./commands/list-services.js")(program);
require("./commands/select.js")(program);
require("./commands/download.js")(program);

program.parse();
