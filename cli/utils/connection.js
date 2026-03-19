const configUtil = require("./config.js");

function resolveConfig(flags) {
  const env = {
    host: process.env.CUCM_HOST || process.env.CUCM_HOSTNAME || undefined,
    username: process.env.CUCM_USERNAME || undefined,
    password: process.env.CUCM_PASSWORD || undefined,
  };

  let fileConfig = {};
  const clusterName = flags.cluster || undefined;
  const cluster = configUtil.getActiveCluster(clusterName);
  if (cluster) { fileConfig = cluster; }

  const resolved = {
    host: flags.host || env.host || fileConfig.host,
    username: flags.username || env.username || fileConfig.username,
    password: flags.password || env.password || fileConfig.password,
    insecure: flags.insecure || fileConfig.insecure || false,
  };

  if (!resolved.host || !resolved.username || !resolved.password) {
    throw new Error(
      'No cluster configured. Set one up with:\n' +
      '  cisco-dime config add <name> --host <h> --username <u> --password <p>\n' +
      '  Or set environment variables: CUCM_HOST, CUCM_USERNAME, CUCM_PASSWORD'
    );
  }

  if (configUtil.hasSsPlaceholders(resolved)) {
    const resolvedSecrets = configUtil.resolveSsPlaceholders(resolved);
    Object.assign(resolved, resolvedSecrets);
  }

  return resolved;
}

module.exports = { resolveConfig };
