const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("./config.js");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getAuditPath() { return path.join(getConfigDir(), "audit.jsonl"); }

function rotateIfNeeded(auditPath) {
  try {
    const stats = fs.statSync(auditPath);
    if (stats.size >= MAX_FILE_SIZE) {
      const rotated = auditPath + ".1";
      if (fs.existsSync(rotated)) { fs.unlinkSync(rotated); }
      fs.renameSync(auditPath, rotated);
    }
  } catch { /* File doesn't exist yet */ }
}

function log(entry) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  const auditPath = getAuditPath();
  rotateIfNeeded(auditPath);
  fs.appendFileSync(auditPath, JSON.stringify({ timestamp: new Date().toISOString(), ...entry }) + "\n");
}

module.exports = { log };
