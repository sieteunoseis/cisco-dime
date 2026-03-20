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
    let dateStr;
    if (file.modified) {
      const parsed = new Date(file.modified);
      dateStr = isNaN(parsed.getTime()) ? new Date().toISOString().split("T")[0] : parsed.toISOString().split("T")[0];
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
    final(callback) { writeStream.end(callback); },
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
    const largeFiles = hostFiles.filter((f) => parseSizeToBytes(f.size) > STREAM_THRESHOLD);
    const smallFiles = hostFiles.filter((f) => parseSizeToBytes(f.size) <= STREAM_THRESHOLD);

    // Stream large files individually
    for (const file of largeFiles) {
      const savePath = getSavePath(file, outputDir, opts.organize);
      try {
        const bytes = await downloadOneStreaming(dime, host, connConfig.username, connConfig.password, file, savePath);
        totalBytes += bytes;
        successCount++;
        process.stderr.write(`  OK: ${path.basename(file.filename)} (${formatBytes(bytes)}) [streamed]\n`);
      } catch (err) {
        failCount++;
        process.stderr.write(`  FAIL: ${file.filename} - ${err.message}\n`);
      }
    }

    // Batch download small files
    if (smallFiles.length > 0) {
      const filenames = smallFiles.map((f) => f.filename);
      await dime.getMultipleFiles(host, connConfig.username, connConfig.password, filenames, {
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
      });
    }
  }

  console.log(`\nDownload complete: ${successCount} succeeded, ${failCount} failed, ${formatBytes(totalBytes)} total`);
  if (!opts.noAudit) {
    audit.log({ cluster: connConfig.host, command: "download", status: failCount > 0 ? "partial" : "success", files: successCount, failedFiles: failCount, totalBytes });
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
    .option("--file <path>", "download a specific file by full path")
    .option("--output-dir <dir>", "directory to save files (default: cwd)")
    .option("--organize", "organize into host/date subdirectories")
    .option("--decompress", "decompress .gz files after download")
    .action(async (indices, cmdOpts) => {
      try {
        const globalOpts = program.opts();
        const connConfig = resolveConfig(globalOpts);
        const concurrency = parseInt(globalOpts.concurrency, 10) || 5;
        if (connConfig.insecure) { process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; }
        if (globalOpts.debug) { process.env.DEBUG = "cisco-dime"; }

        let files;
        if (cmdOpts.file) {
          files = [{ index: 1, filename: cmdOpts.file, host: connConfig.host }];
        } else if (cmdOpts.all) {
          const cached = cache.loadSelectResults();
          if (!cached) { throw new Error('No cached select results. Run "cisco-dime select" first.'); }
          files = cached;
        } else if (indices) {
          files = cache.resolveFiles(indices);
        } else {
          throw new Error("Specify file indices (e.g., 1,3,5), --all, or --file <path>.");
        }

        await downloadFiles(files, connConfig, {
          outputDir: cmdOpts.outputDir, organize: cmdOpts.organize, decompress: cmdOpts.decompress,
          concurrency, format: globalOpts.format, noAudit: globalOpts.audit === false,
        });
      } catch (err) { printError(err); }
    });
}

module.exports = registerCommand;
module.exports.downloadFiles = downloadFiles;
