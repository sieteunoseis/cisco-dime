/**
 * Renders a SIP ladder diagram from parsed SIP messages.
 * Uses fixed-width columns with consistent pipe alignment.
 */

const COL_WIDTH = 30;
const ARROW_CHAR = "-";

/**
 * Identify unique endpoints from messages.
 * CUCM is always in the center since all messages pass through it.
 */
function identifyEndpoints(messages, cucmIp) {
  const ips = new Set();
  for (const msg of messages) {
    ips.add(msg.remoteIp);
  }
  // CUCM is implied — it's the trace source. Remote IPs are the other endpoints.
  // Sort endpoints: phones (sent INVITEs to CUCM) on the left, trunks/gateways on the right
  const left = [];
  const right = [];

  for (const ip of ips) {
    // Check if this IP sent an INVITE (it's a calling device → left side)
    const sentInvite = messages.some(
      (m) => m.remoteIp === ip && m.direction === "incoming" && m.method === "INVITE" && !m.statusCode
    );
    if (sentInvite) {
      left.push(ip);
    } else {
      right.push(ip);
    }
  }

  // Build ordered list: [left endpoints] [CUCM] [right endpoints]
  const endpoints = [];
  for (const ip of left) endpoints.push({ ip, label: ip, side: "left" });
  endpoints.push({ ip: cucmIp || "CUCM", label: cucmIp || "CUCM", side: "center" });
  for (const ip of right) endpoints.push({ ip, label: ip, side: "right" });

  return endpoints;
}

/**
 * Render the ladder diagram as a string
 */
function render(messages, opts = {}) {
  if (messages.length === 0) return "No SIP messages found.";

  const cucmIp = opts.cucmIp || detectCucmIp(messages);
  const endpoints = identifyEndpoints(messages, cucmIp);

  if (endpoints.length < 2) return "Not enough endpoints to render a ladder diagram.";

  const lines = [];

  // Header
  lines.push("");
  lines.push(renderHeader(endpoints));
  lines.push(renderSeparator(endpoints));
  lines.push(renderPipes(endpoints));

  // Messages
  for (const msg of messages) {
    const fromIdx = msg.direction === "incoming"
      ? endpoints.findIndex((e) => e.ip === msg.remoteIp)
      : endpoints.findIndex((e) => e.side === "center");

    const toIdx = msg.direction === "incoming"
      ? endpoints.findIndex((e) => e.side === "center")
      : endpoints.findIndex((e) => e.ip === msg.remoteIp);

    if (fromIdx === -1 || toIdx === -1) continue;

    const label = msg.statusCode
      ? `${msg.statusCode} ${msg.statusText}`
      : msg.method;

    lines.push(renderArrow(endpoints, fromIdx, toIdx, label, msg.timestamp));
    lines.push(renderPipes(endpoints));
  }

  lines.push("");
  return lines.join("\n");
}

function detectCucmIp(messages) {
  // CUCM IP appears in outgoing messages as the trace source
  // Look for the IP that isn't a remote IP but appears in request URIs
  const remoteIps = new Set(messages.map((m) => m.remoteIp));
  for (const msg of messages) {
    if (msg.requestUri) {
      const ipMatch = msg.requestUri.match(/@([\d.]+)/);
      if (ipMatch && !remoteIps.has(ipMatch[1])) {
        return ipMatch[1];
      }
    }
  }
  return "CUCM";
}

function renderHeader(endpoints) {
  return endpoints
    .map((e) => centerPad(e.label, COL_WIDTH))
    .join("");
}

function renderSeparator(endpoints) {
  return endpoints
    .map((e) => centerPad(Array(Math.min(e.label.length + 2, COL_WIDTH)).join("-"), COL_WIDTH))
    .join("");
}

function renderPipes(endpoints) {
  return endpoints
    .map(() => centerPad("|", COL_WIDTH))
    .join("");
}

function renderArrow(endpoints, fromIdx, toIdx, label, timestamp) {
  const totalCols = endpoints.length;
  const leftIdx = Math.min(fromIdx, toIdx);
  const rightIdx = Math.max(fromIdx, toIdx);
  const goingRight = fromIdx < toIdx;

  // Build the line character by character using column positions
  const colCenter = (idx) => idx * COL_WIDTH + Math.floor(COL_WIDTH / 2);
  const leftPos = colCenter(leftIdx);
  const rightPos = colCenter(rightIdx);
  const totalWidth = totalCols * COL_WIDTH;

  const chars = new Array(totalWidth).fill(" ");

  // Draw pipes for columns not involved in the arrow
  for (let c = 0; c < totalCols; c++) {
    if (c < leftIdx || c > rightIdx) {
      chars[colCenter(c)] = "|";
    }
  }

  // Draw the arrow line
  const arrowStart = leftPos;
  const arrowEnd = rightPos;

  for (let p = arrowStart; p <= arrowEnd; p++) {
    chars[p] = ARROW_CHAR;
  }

  // Arrow head
  if (goingRight) {
    chars[arrowEnd] = ">";
    chars[arrowStart] = "|";
  } else {
    chars[arrowStart] = "<";
    chars[arrowEnd] = "|";
  }

  // Place label on the arrow
  const labelStr = ` ${label} `;
  const labelStart = arrowStart + Math.floor((arrowEnd - arrowStart - labelStr.length) / 2);
  if (labelStart > arrowStart && labelStart + labelStr.length < arrowEnd) {
    for (let k = 0; k < labelStr.length; k++) {
      chars[labelStart + k] = labelStr[k];
    }
  }

  // Timestamp on the left margin
  const line = chars.join("");
  const ts = timestamp.substring(0, 12); // HH:MM:SS.mmm
  return ts + "  " + line;
}

function centerPad(str, width) {
  const pad = Math.max(0, width - str.length);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

module.exports = { render, identifyEndpoints };
