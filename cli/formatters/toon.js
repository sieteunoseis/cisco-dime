async function formatToon(data) {
  const { encode } = await import("@toon-format/toon");
  return encode(data);
}
module.exports = formatToon;
