const DURATION_RE = /^(\d+)(m|h|d)$/;

const CISCO_TIMEZONES = {
  "Pacific/Honolulu": "Client: (GMT-10:0)Hawaii Standard Time-Pacific/Honolulu",
  "America/Anchorage": "Client: (GMT-9:0)Alaska Standard Time-America/Anchorage",
  "America/Los_Angeles": "Client: (GMT-8:0)Pacific Standard Time-America/Los_Angeles",
  "America/Denver": "Client: (GMT-7:0)Mountain Standard Time-America/Denver",
  "America/Phoenix": "Client: (GMT-7:0)US Mountain Standard Time-America/Phoenix",
  "America/Chicago": "Client: (GMT-6:0)Central Standard Time-America/Chicago",
  "America/New_York": "Client: (GMT-5:0)Eastern Standard Time-America/New_York",
  "America/Indianapolis": "Client: (GMT-5:0)US Eastern Standard Time-America/Indianapolis",
  "America/Halifax": "Client: (GMT-4:0)Atlantic Standard Time-America/Halifax",
  "America/St_Johns": "Client: (GMT-3:30)Newfoundland Standard Time-America/St_Johns",
  "America/Sao_Paulo": "Client: (GMT-3:0)E. South America Standard Time-America/Sao_Paulo",
  "Atlantic/South_Georgia": "Client: (GMT-2:0)Mid-Atlantic Standard Time-Atlantic/South_Georgia",
  "Atlantic/Azores": "Client: (GMT-1:0)Azores Standard Time-Atlantic/Azores",
  "UTC": "Client: (GMT+0:0)GMT Standard Time-UTC",
  "Europe/London": "Client: (GMT+0:0)GMT Standard Time-Europe/London",
  "Europe/Paris": "Client: (GMT+1:0)Romance Standard Time-Europe/Paris",
  "Europe/Berlin": "Client: (GMT+1:0)W. Europe Standard Time-Europe/Berlin",
  "Europe/Helsinki": "Client: (GMT+2:0)FLE Standard Time-Europe/Helsinki",
  "Europe/Moscow": "Client: (GMT+3:0)Russian Standard Time-Europe/Moscow",
  "Asia/Dubai": "Client: (GMT+4:0)Arabian Standard Time-Asia/Dubai",
  "Asia/Kolkata": "Client: (GMT+5:30)India Standard Time-Asia/Kolkata",
  "Asia/Dhaka": "Client: (GMT+6:0)Central Asia Standard Time-Asia/Dhaka",
  "Asia/Bangkok": "Client: (GMT+7:0)SE Asia Standard Time-Asia/Bangkok",
  "Asia/Shanghai": "Client: (GMT+8:0)China Standard Time-Asia/Shanghai",
  "Asia/Singapore": "Client: (GMT+8:0)Singapore Standard Time-Asia/Singapore",
  "Asia/Tokyo": "Client: (GMT+9:0)Tokyo Standard Time-Asia/Tokyo",
  "Australia/Sydney": "Client: (GMT+10:0)AUS Eastern Standard Time-Australia/Sydney",
  "Pacific/Auckland": "Client: (GMT+12:0)New Zealand Standard Time-Pacific/Auckland",
};

function parseDuration(str) {
  const match = str.match(DURATION_RE);
  if (!match) {
    throw new Error(`Invalid duration "${str}". Expected format: <number><m|h|d> (e.g., 30m, 2h, 1d)`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * multipliers[unit];
}

function parseTimeArg(str) {
  if (str === "now") { return new Date(); }
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new Error(`Cannot parse "${str}" as a date. Use ISO 8601 (2026-03-19T08:00:00), "2026-03-19 08:00", or "now".`);
  }
  return date;
}

function toCiscoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  const hoursStr = String(hours).padStart(2, "0");
  return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
}

function resolveTimeRange(opts) {
  if (opts.last && (opts.from || opts.to)) {
    throw new Error("--last and --from/--to are mutually exclusive. Use one or the other.");
  }
  if (opts.last) {
    const duration = parseDuration(opts.last);
    const to = new Date();
    const from = new Date(to.getTime() - duration);
    return { from, to };
  }
  if (opts.from) {
    const from = parseTimeArg(opts.from);
    const to = opts.to ? parseTimeArg(opts.to) : new Date();
    return { from, to };
  }
  throw new Error("A time range is required. Use --last <duration> or --from <date> [--to <date>].");
}

function getSystemTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function toCiscoTimezone(iana) {
  if (CISCO_TIMEZONES[iana]) { return CISCO_TIMEZONES[iana]; }
  throw new Error(`Unknown timezone "${iana}". Supported timezones:\n` + Object.keys(CISCO_TIMEZONES).join(", "));
}

module.exports = { parseDuration, parseTimeArg, toCiscoDate, resolveTimeRange, getSystemTimezone, toCiscoTimezone, CISCO_TIMEZONES };
