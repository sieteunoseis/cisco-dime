# Changelog

## v2.0.0

### Breaking Changes

- **`selectLogFiles()` and `listNodeServiceLogs()` now always return arrays**, even for single results.

### New Features

- **CLI** -- full command-line interface: `config`, `list-services`, `select`, `download`
- **Built-in presets** -- `sip-traces`, `cti-traces`, `curri-logs`, `syslog`, `tomcat`, `oamp`, `audit` + custom presets
- **Flexible time parser** -- `30m`, `2h`, `1d`, `now`, ISO 8601, date-time strings
- **Indexed select-then-download workflow** -- select results are numbered and cached for easy download by index
- **Multi-cluster config** -- named clusters at `~/.cisco-dime/config.json` with Secret Server support
- **Output formats** -- `--format table|json|toon|csv`
- **Active file filtering** -- `.gzo` files skipped by default, `--include-active` to include
- **File organization** -- `--organize` saves downloads into `<host>/<date>/` subdirectories
- **Decompression** -- `--decompress` gunzips `.gz` files after download
- **Streaming** -- large files are streamed to disk without buffering in memory
- **Audit trail** -- JSONL audit log at `~/.cisco-dime/audit.jsonl` with 10MB rotation
- **skills.sh skill** -- AI agent skill at `skills/cisco-dime-cli/SKILL.md`

### Bug Fixes

- **Session cookie scoping** -- cookies now scoped per SOAP service endpoint
- **Pinned dependencies** -- `xml2js` pinned to `^0.6.2`, `dotenv` to `^16.4.5`

## v1.10.0

- **`getMultipleFiles()`** -- batch download with concurrency control
- **`getOneFileStream()`** -- stream large files to disk
- **`selectLogFilesMulti()`** -- query across multiple hosts
- **Custom error types** -- programmatic error handling
- **Debug logging** -- opt-in via `DEBUG=cisco-dime`
- **Unit tests** -- mocked SOAP response tests for CI

## v1.9.0

- **TypeScript support** -- full type declarations
- **ESM support** -- `main.mjs` wrapper + `exports` field
- **Named parameters** -- `selectLogFiles()` accepts options object
- **Cookie/session reuse** -- automatic capture from responses
- **Request timeouts** -- `AbortController`-based (default 30s)
- **Retry with exponential backoff** -- automatic on failure/rate limiting
- **Progress callback** -- `getOneFile()` accepts `onProgress`
