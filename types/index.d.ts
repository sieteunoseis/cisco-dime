/**
 * TypeScript declarations for cisco-dime
 */

export interface DimeConfig {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retries on failure (default: 3) */
  retries?: number;
  /** Base delay between retries in milliseconds, doubles each attempt (default: 1000) */
  retryDelay?: number;
}

export interface GetOneFileOptions extends DimeConfig {
  /** Progress callback for tracking download progress */
  onProgress?: (progress: ProgressInfo) => void;
}

export interface ProgressInfo {
  /** Total bytes read so far */
  bytesRead: number;
  /** Total content length from headers, or null if unknown */
  contentLength: number | null;
  /** Download percentage (0-100), or null if content length unknown */
  percent: number | null;
}

export interface FileResult {
  /** File content as a Buffer */
  data: Buffer;
  /** Original filename/path requested */
  filename: string;
  /** Server hostname the file was retrieved from */
  server: string;
}

export interface LogFile {
  /** Filename */
  name?: string;
  /** Full file path on server */
  absolutepath?: string;
  /** File size */
  filesize?: string;
  /** Last modified timestamp */
  modifiedDate?: string;
  /** Server hostname */
  server: string;
  [key: string]: string | undefined;
}

export interface NodeServiceLog {
  /** Server/node name */
  server: string;
  /** List of service log names */
  servicelogs: string[];
  /** Number of service logs */
  count: number;
}

export interface SelectLogFilesOptions extends DimeConfig {
  /** Hostname or IP address */
  host: string;
  /** AXL username */
  username: string;
  /** AXL password */
  password: string;
  /** Service log name (e.g., "Cisco CallManager") */
  servicelog: string;
  /** Start date/time string */
  fromdate: string;
  /** End date/time string */
  todate: string;
  /** Timezone string (e.g., "Client: (GMT-8:0)America/Los_Angeles") */
  timezone: string;
}

/**
 * Retrieve a single file from a Cisco UC product via DIME.
 * @param host - Hostname or IP address
 * @param username - AXL username
 * @param password - AXL password
 * @param file - Full file path on the server
 * @param options - Optional configuration (timeout, retries, onProgress)
 * @returns File content, filename, and server info
 */
export function getOneFile(
  host: string,
  username: string,
  password: string,
  file: string,
  options?: GetOneFileOptions
): Promise<FileResult>;

/**
 * List available service log files matching selection criteria.
 *
 * Supports both positional parameters and a named options object.
 *
 * @example
 * // Positional parameters
 * await selectLogFiles(host, username, password, servicelog, fromdate, todate, timezone);
 *
 * @example
 * // Named parameters
 * await selectLogFiles({ host, username, password, servicelog, fromdate, todate, timezone });
 */
export function selectLogFiles(
  host: string,
  username: string,
  password: string,
  servicelog: string,
  fromdate: string,
  todate: string,
  timezone: string
): Promise<LogFile[]>;

export function selectLogFiles(options: SelectLogFilesOptions): Promise<LogFile[]>;

/**
 * List node names in the cluster and associated service names.
 * @param host - Hostname or IP address
 * @param username - AXL username
 * @param password - AXL password
 * @param options - Optional configuration (timeout, retries)
 * @returns Node service log information (single object or array for multi-node clusters)
 */
export function listNodeServiceLogs(
  host: string,
  username: string,
  password: string,
  options?: DimeConfig
): Promise<NodeServiceLog | NodeServiceLog[]>;

/**
 * Get the stored session cookie for a host.
 * @param host - Hostname to retrieve cookie for
 * @returns Cookie string or null
 */
export function getCookie(host: string): string | null;

/**
 * Set a session cookie for a host.
 * @param host - Hostname to store cookie for
 * @param cookie - Cookie string value
 */
export function setCookie(host: string, cookie: string): void;
