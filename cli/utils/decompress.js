const { gunzipSync } = require("node:zlib");

function isGzFile(filename) { return filename.endsWith(".gz"); }

function stripGzExtension(filename) {
  return filename.endsWith(".gz") ? filename.slice(0, -3) : filename;
}

function tryDecompress(buffer, filename) {
  try {
    const data = gunzipSync(buffer);
    return { success: true, data, outputName: stripGzExtension(filename) };
  } catch (err) {
    return { success: false, data: buffer, outputName: filename, warning: `File "${filename}" appears truncated (may still be written to). Saved as-is without decompression.` };
  }
}

module.exports = { isGzFile, stripGzExtension, tryDecompress };
