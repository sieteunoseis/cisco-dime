const { stringify } = require("csv-stringify/sync");
function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  return stringify(rows, { header: true, columns });
}
module.exports = formatCsv;
