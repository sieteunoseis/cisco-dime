const fs = require("node:fs");
const path = require("node:path");

/**
 * Parse SIP messages from one or more SDL trace files.
 * Returns an array of SIP message objects sorted by timestamp.
 */
function parseFiles(filePaths) {
  const messages = [];
  for (const filePath of filePaths) {
    const content = fs.readFileSync(filePath, "utf-8");
    messages.push(...parseSdlTrace(content));
  }
  // Sort by timestamp
  messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  // Deduplicate (same timestamp + method + from + to)
  return dedup(messages);
}

function parseSdlTrace(content) {
  const lines = content.split("\n");
  const messages = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Match "Incoming SIP TCP/UDP message from <ip>" or "Outgoing SIP TCP/UDP message to <ip>"
    const inMatch = line.match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|AppInfo\s*\|SIPTcp - wait_SdlReadRsp: Incoming SIP (?:TCP|UDP) message from ([\d.]+)/
    ) || line.match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|AppInfo\s*\|\/\/SIP\/SIPUdp\/wait_SdlSPISignal: Incoming SIP UDP message from ([\d.]+)/
    );

    const outMatch = line.match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|AppInfo\s*\|SIPTcp - wait_SdlSPISignal: Outgoing SIP (?:TCP|UDP) message to ([\d.]+)/
    ) || line.match(
      /(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|AppInfo\s*\|\/\/SIP\/SIPUdp\/wait_SdlSPISignal: Outgoing SIP UDP message to ([\d.]+)/
    );

    if (inMatch || outMatch) {
      const match = inMatch || outMatch;
      const direction = inMatch ? "incoming" : "outgoing";
      const timestamp = match[1];
      const remoteIp = match[2];

      // Scan forward to find the SIP request/response line
      const sipMsg = extractSipMessage(lines, i + 1);
      if (sipMsg) {
        messages.push({
          timestamp,
          direction,
          remoteIp,
          method: sipMsg.method,
          statusCode: sipMsg.statusCode,
          statusText: sipMsg.statusText,
          requestUri: sipMsg.requestUri,
          callId: sipMsg.callId,
          from: sipMsg.from,
          to: sipMsg.to,
          cseq: sipMsg.cseq,
        });
      }
    }
    i++;
  }
  return messages;
}

function extractSipMessage(lines, startIdx) {
  // Look ahead up to 40 lines for the SIP message start
  for (let j = startIdx; j < Math.min(startIdx + 5, lines.length); j++) {
    const line = lines[j].trim();

    // SIP Request: METHOD sip:... SIP/2.0
    const reqMatch = line.match(/^(INVITE|ACK|BYE|CANCEL|NOTIFY|OPTIONS|REFER|REGISTER|UPDATE|SUBSCRIBE|INFO|PRACK|MESSAGE|PUBLISH)\s+(\S+)\s+SIP\/2\.0/);
    if (reqMatch) {
      const headers = extractHeaders(lines, j + 1);
      return {
        method: reqMatch[1],
        statusCode: null,
        statusText: null,
        requestUri: reqMatch[2],
        callId: headers.callId,
        from: headers.from,
        to: headers.to,
        cseq: headers.cseq,
      };
    }

    // SIP Response: SIP/2.0 <code> <text>
    const respMatch = line.match(/^SIP\/2\.0\s+(\d{3})\s+(.+)/);
    if (respMatch) {
      const headers = extractHeaders(lines, j + 1);
      return {
        method: headers.cseqMethod,
        statusCode: parseInt(respMatch[1], 10),
        statusText: respMatch[2],
        requestUri: null,
        callId: headers.callId,
        from: headers.from,
        to: headers.to,
        cseq: headers.cseq,
      };
    }
  }
  return null;
}

function extractHeaders(lines, startIdx) {
  const result = { callId: null, from: null, to: null, cseq: null, cseqMethod: null };

  for (let j = startIdx; j < Math.min(startIdx + 40, lines.length); j++) {
    const line = lines[j].trim();
    // Stop at empty line (end of headers) or SDL trace line
    if (line === "" || line.match(/^\d+\.\d+\s*\|/)) break;

    if (line.startsWith("Call-ID:")) {
      result.callId = line.replace("Call-ID:", "").trim();
    } else if (line.startsWith("From:")) {
      const uriMatch = line.match(/sip:([^@>]+)/);
      result.from = uriMatch ? uriMatch[1] : line.replace("From:", "").trim();
    } else if (line.startsWith("To:")) {
      const uriMatch = line.match(/sip:([^@>]+)/);
      result.to = uriMatch ? uriMatch[1] : line.replace("To:", "").trim();
    } else if (line.startsWith("CSeq:")) {
      result.cseq = line.replace("CSeq:", "").trim();
      const cseqParts = result.cseq.split(/\s+/);
      result.cseqMethod = cseqParts.length > 1 ? cseqParts[1] : null;
    }
  }
  return result;
}

function dedup(messages) {
  const seen = new Set();
  return messages.filter((msg) => {
    const key = `${msg.timestamp}|${msg.method}|${msg.statusCode}|${msg.remoteIp}|${msg.callId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Filter messages by various criteria
 */
function filterMessages(messages, opts = {}) {
  let filtered = messages;

  if (opts.number) {
    const num = opts.number.replace(/[^0-9+]/g, "");
    filtered = filtered.filter(
      (m) =>
        (m.from && m.from.includes(num)) ||
        (m.to && m.to.includes(num)) ||
        (m.requestUri && m.requestUri.includes(num))
    );
  }

  if (opts.device) {
    const dev = opts.device.toUpperCase();
    filtered = filtered.filter(
      (m) =>
        (m.from && m.from.toUpperCase().includes(dev)) ||
        (m.to && m.to.toUpperCase().includes(dev)) ||
        (m.callId && m.callId.toUpperCase().includes(dev))
    );
  }

  if (opts.callId) {
    filtered = filtered.filter((m) => m.callId === opts.callId);
  }

  if (opts.from) {
    filtered = filtered.filter((m) => m.timestamp >= opts.from);
  }

  if (opts.to) {
    filtered = filtered.filter((m) => m.timestamp <= opts.to);
  }

  return filtered;
}

/**
 * Group messages by Call-ID to identify distinct calls
 */
function groupByCalls(messages) {
  const calls = new Map();
  for (const msg of messages) {
    if (!msg.callId) continue;
    if (!calls.has(msg.callId)) {
      calls.set(msg.callId, []);
    }
    calls.get(msg.callId).push(msg);
  }
  return calls;
}

module.exports = { parseFiles, filterMessages, groupByCalls };
