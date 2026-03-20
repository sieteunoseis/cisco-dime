const Table = require("cli-table3");
function formatTable(data) {
  if (Array.isArray(data)) { return formatListTable(data); }
  return formatItemTable(data);
}
function formatListTable(rows) {
  if (rows.length === 0) return "No results found";
  const columns = Object.keys(rows[0]);
  const table = new Table({ head: columns });
  for (const row of rows) { table.push(columns.map((col) => String(row[col] ?? ""))); }
  return `${table.toString()}\n${rows.length} result${rows.length !== 1 ? "s" : ""} found`;
}
function formatItemTable(item) {
  const table = new Table();
  for (const [key, value] of Object.entries(item)) {
    const displayValue = typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value ?? "");
    table.push({ [key]: displayValue });
  }
  return table.toString();
}
module.exports = formatTable;
