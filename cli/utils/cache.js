const fs = require("node:fs");
const path = require("node:path");
const { getConfigDir } = require("./config.js");

function getCachePath() {
  return path.join(getConfigDir(), "last-select.json");
}

function saveSelectResults(files) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  fs.writeFileSync(getCachePath(), JSON.stringify(files, null, 2));
}

function loadSelectResults() {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) { return null; }
  return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
}

function parseIndices(str) {
  const indices = [];
  for (const part of str.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [startStr, endStr] = trimmed.split("-");
      for (let i = parseInt(startStr, 10); i <= parseInt(endStr, 10); i++) { indices.push(i); }
    } else {
      indices.push(parseInt(trimmed, 10));
    }
  }
  return indices;
}

function resolveFiles(indexStr) {
  const cached = loadSelectResults();
  if (!cached) { throw new Error('No cached select results. Run "cisco-dime select" first.'); }
  const indices = parseIndices(indexStr);
  const files = [];
  for (const idx of indices) {
    const file = cached.find((f) => f.index === idx);
    if (!file) { throw new Error(`Index ${idx} not found in cached results. Run "cisco-dime select" to refresh.`); }
    files.push(file);
  }
  return files;
}

module.exports = { saveSelectResults, loadSelectResults, parseIndices, resolveFiles };
