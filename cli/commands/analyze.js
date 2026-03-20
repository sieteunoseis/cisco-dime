const fs = require("node:fs");
const path = require("node:path");
const { parseFiles, filterMessages, groupByCalls } = require("../utils/sdl-parser.js");
const { render } = require("../utils/sip-ladder.js");
const { printResult } = require("../utils/output.js");

module.exports = function (program) {
  const analyze = program
    .command("analyze")
    .description("Analyze downloaded log files");

  analyze
    .command("list [directory]")
    .description("List downloaded trace files in a directory")
    .action((directory) => {
      const dir = directory || ".";
      const globalOpts = program.optsWithGlobals();

      if (!fs.existsSync(dir)) {
        console.error(`Error: Directory "${dir}" does not exist.`);
        process.exitCode = 1;
        return;
      }

      const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith(".txt") || f.endsWith(".gz") || f.endsWith(".gzo") || f.endsWith(".log"))
        .map((f, i) => {
          const stats = fs.statSync(path.join(dir, f));
          return {
            index: i + 1,
            filename: f,
            size: formatSize(stats.size),
            modified: stats.mtime.toLocaleString(),
          };
        });

      if (files.length === 0) {
        console.log("No trace files found in this directory.");
        return;
      }

      // Cache the file list for index-based access
      const cacheData = { directory: path.resolve(dir), files: files.map((f) => f.filename) };
      const cachePath = path.join(
        process.env.HOME || process.env.USERPROFILE,
        ".cisco-dime",
        "last-analyze.json"
      );
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));

      printResult(files, globalOpts.format, ["index", "filename", "size", "modified"]);
      console.log(`\n${files.length} file(s) found`);
    });

  analyze
    .command("sip-ladder [files...]")
    .description("Render a SIP ladder diagram from SDL trace files")
    .option("--all", "use all files from last analyze list")
    .option("--number <number>", "filter by calling/called number")
    .option("--device <name>", "filter by device name (e.g., SEP001122334455)")
    .option("--call-id <id>", "filter by SIP Call-ID")
    .option("--from <time>", "filter from time (HH:MM:SS)")
    .option("--to <time>", "filter to time (HH:MM:SS)")
    .option("--list-calls", "list distinct calls instead of rendering a ladder")
    .action((files, opts) => {
      const filePaths = resolveFiles(files, opts);
      if (!filePaths || filePaths.length === 0) {
        console.error("Error: No files specified. Use file paths, indexes from 'analyze list', or --all.");
        process.exitCode = 1;
        return;
      }

      // Verify files exist
      for (const fp of filePaths) {
        if (!fs.existsSync(fp)) {
          console.error(`Error: File not found: ${fp}`);
          process.exitCode = 1;
          return;
        }
      }

      console.log(`Parsing ${filePaths.length} file(s)...`);
      const messages = parseFiles(filePaths);
      console.log(`Found ${messages.length} SIP message(s).`);

      if (messages.length === 0) {
        console.log("No SIP messages found in the specified files.");
        return;
      }

      // Apply filters
      const filtered = filterMessages(messages, {
        number: opts.number,
        device: opts.device,
        callId: opts.callId,
        from: opts.from,
        to: opts.to,
      });

      if (filtered.length === 0) {
        console.log("No SIP messages match the filter criteria.");
        return;
      }

      // List calls mode
      if (opts.listCalls) {
        const calls = groupByCalls(filtered);
        const callList = [];
        let idx = 1;
        for (const [callId, msgs] of calls) {
          const firstMsg = msgs[0];
          const lastMsg = msgs[msgs.length - 1];
          const invite = msgs.find((m) => m.method === "INVITE" && !m.statusCode);
          callList.push({
            index: idx++,
            from: invite ? invite.from : firstMsg.from || "?",
            to: invite ? invite.to : firstMsg.to || "?",
            start: firstMsg.timestamp,
            end: lastMsg.timestamp,
            messages: msgs.length,
            callId: callId.substring(0, 30) + (callId.length > 30 ? "..." : ""),
          });
        }
        const globalOpts = program.optsWithGlobals();
        printResult(callList, globalOpts.format, ["index", "from", "to", "start", "end", "messages", "callId"]);
        console.log(`\n${callList.length} call(s) found`);
        return;
      }

      // If multiple calls and no filter, ask user to pick
      const calls = groupByCalls(filtered);
      if (calls.size > 1 && !opts.number && !opts.device && !opts.callId) {
        console.log(`\nFound ${calls.size} distinct calls. Use --number, --device, --call-id, or --list-calls to narrow down.\n`);
        const callList = [];
        let idx = 1;
        for (const [callId, msgs] of calls) {
          const invite = msgs.find((m) => m.method === "INVITE" && !m.statusCode);
          callList.push({
            index: idx++,
            from: invite ? invite.from : "?",
            to: invite ? invite.to : "?",
            start: msgs[0].timestamp,
            messages: msgs.length,
          });
        }
        const globalOpts = program.optsWithGlobals();
        printResult(callList, globalOpts.format, ["index", "from", "to", "start", "messages"]);
        return;
      }

      // Render ladder
      console.log(render(filtered));
    });
};

function resolveFiles(files, opts) {
  const cachePath = path.join(
    process.env.HOME || process.env.USERPROFILE,
    ".cisco-dime",
    "last-analyze.json"
  );

  // --all flag: use all cached files
  if (opts.all) {
    if (!fs.existsSync(cachePath)) {
      console.error('Error: No cached file list. Run "cisco-dime analyze list <dir>" first.');
      return null;
    }
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    return cache.files.map((f) => path.join(cache.directory, f));
  }

  if (!files || files.length === 0) return null;

  // Check if arguments are indexes (numbers or ranges)
  const allNumeric = files.every((f) => /^[\d,\-]+$/.test(f));
  if (allNumeric) {
    if (!fs.existsSync(cachePath)) {
      console.error('Error: No cached file list. Run "cisco-dime analyze list <dir>" first.');
      return null;
    }
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    const indexes = parseIndexes(files.join(","), cache.files.length);
    return indexes.map((i) => path.join(cache.directory, cache.files[i - 1]));
  }

  // Otherwise treat as file paths
  return files;
}

function parseIndexes(input, max) {
  const indexes = new Set();
  for (const part of input.split(",")) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      for (let i = start; i <= Math.min(end, max); i++) indexes.add(i);
    } else {
      const n = parseInt(part, 10);
      if (n >= 1 && n <= max) indexes.add(n);
    }
  }
  return [...indexes].sort((a, b) => a - b);
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(1) + "MB";
}
