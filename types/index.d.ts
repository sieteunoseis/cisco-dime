/**
 * TypeScript declarations for cisco-dime
 */

// --- Configuration Types ---

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

export interface GetMultipleFilesOptions extends GetOneFileOptions {
  /** Maximum concurrent downloads (default: 5) */
  concurrency?: number;
  /** Called when each individual file completes or fails */
  onFileComplete?: (error: Error | null, result: FileResult | null, index: number) => void;
}

export interface SelectLogFilesMultiOptions extends DimeConfig {
  /** Maximum concurrent host queries (default: 5) */
  concurrency?: number;
}

export interface ProgressInfo {
  /** Total bytes read so far */
  bytesRead: number;
  /** Total content length from headers, or null if unknown */
  contentLength: number | null;
  /** Download percentage (0-100), or null if content length unknown */
  percent: number | null;
}

export interface ProgressInfoWithFile extends ProgressInfo {
  /** Filename being downloaded */
  filename: string;
  /** Index of the file in the batch */
  fileIndex: number;
}

// --- Result Types ---

export interface FileResult {
  /** File content as a Buffer */
  data: Buffer;
  /** Original filename/path requested */
  filename: string;
  /** Server hostname the file was retrieved from */
  server: string;
}

export interface FileResultOrError {
  /** File content (present on success) */
  data?: Buffer;
  /** Error (present on failure) */
  error?: Error;
  /** Original filename/path requested */
  filename: string;
  /** Server hostname */
  server: string;
}

export interface FileStreamResult {
  /** Content-Type header from response */
  header: string;
  /** Original filename/path requested */
  filename: string;
  /** Server hostname */
  server: string;
  /** Total content length from headers, or null if unknown */
  contentLength: number | null;
  /** Raw readable stream of the response body */
  body: ReadableStream;
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

// --- Error Types ---

export class DimeError extends Error {
  name: "DimeError";
  host: string | null;
  statusCode: number | null;
  constructor(message: string, options?: { host?: string; statusCode?: number });
}

export class DimeAuthError extends DimeError {
  name: "DimeAuthError";
}

export class DimeNotFoundError extends DimeError {
  name: "DimeNotFoundError";
}

export class DimeTimeoutError extends DimeError {
  name: "DimeTimeoutError";
}

export class DimeRateLimitError extends DimeError {
  name: "DimeRateLimitError";
}

// --- Methods ---

/**
 * Retrieve a single file from a Cisco UC product via DIME.
 */
export function getOneFile(
  host: string,
  username: string,
  password: string,
  file: string,
  options?: GetOneFileOptions
): Promise<FileResult>;

/**
 * Retrieve a single file as a readable stream (avoids buffering large files in memory).
 */
export function getOneFileStream(
  host: string,
  username: string,
  password: string,
  file: string,
  options?: DimeConfig
): Promise<FileStreamResult>;

/**
 * Download multiple files in parallel with concurrency control.
 * Returns results in the same order as the input files array.
 * Failed downloads return an error object instead of throwing.
 */
export function getMultipleFiles(
  host: string,
  username: string,
  password: string,
  files: string[],
  options?: GetMultipleFilesOptions
): Promise<Array<FileResult | FileResultOrError>>;

/**
 * List available service log files matching selection criteria.
 * Supports both positional parameters and a named options object.
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
 * Select log files across multiple hosts and merge results.
 * Failed hosts are silently skipped (return empty results).
 */
export function selectLogFilesMulti(
  hosts: string[],
  username: string,
  password: string,
  servicelog: string,
  fromdate: string,
  todate: string,
  timezone: string,
  options?: SelectLogFilesMultiOptions
): Promise<LogFile[]>;

/**
 * List node names in the cluster and associated service names.
 */
export function listNodeServiceLogs(
  host: string,
  username: string,
  password: string,
  options?: DimeConfig
): Promise<NodeServiceLog | NodeServiceLog[]>;

/**
 * Get the stored session cookie for a host.
 */
export function getCookie(host: string): string | null;

/**
 * Set a session cookie for a host.
 */
export function setCookie(host: string, cookie: string): void;
