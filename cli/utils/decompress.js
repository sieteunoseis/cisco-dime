const { gunzipSync } = require("node:zlib");

function isGzFile(filename) { return filename.endsWith(".gz") || filename.endsWith(".gzo"); }

function stripGzExtension(filename) {
  if (filename.endsWith(".gzo")) return filename.slice(0, -4);
  if (filename.endsWith(".gz")) return filename.slice(0, -3);
  return filename;
}

function tryDecompress(buffer, filename) {
  // .gzo files are plain text (active logs still being written) — just rename
  if (filename.endsWith(".gzo")) {
    return { success: true, data: buffer, outputName: stripGzExtension(filename) };
  }
  try {
    const data = gunzipSync(buffer);
    return { success: true, data, outputName: stripGzExtension(filename) };
  } catch (err) {
    return { success: false, data: buffer, outputName: filename, warning: `File "${filename}" appears truncated (may still be written to). Saved as-is without decompression.` };
  }
}

module.exports = { isGzFile, stripGzExtension, tryDecompress };
