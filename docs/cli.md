# CLI Reference

## Commands

### list-services

Discover all nodes in the cluster and their available service log names.

```bash
cisco-dime list-services
cisco-dime list-services --cluster lab
```

### select

Find log files matching a service name or preset within a time window. Results are numbered and cached to `~/.cisco-dime/last-select.json` for use with `download`.

```bash
# By service name
cisco-dime select "Cisco CallManager" --last 30m
cisco-dime select "Cisco CallManager" --from "2026-03-19 08:00" --to "2026-03-19 09:00"

# By preset
cisco-dime select sip-traces --last 2h
cisco-dime select audit --last 1d

# Multi-host
cisco-dime select sip-traces --last 30m --all-nodes
cisco-dime select sip-traces --last 30m --hosts 10.0.0.1,10.0.0.2

# Select and immediately download
cisco-dime select sip-traces --last 30m --download --output-dir ./logs --organize
```

Time values accept flexible formats: `30m`, `2h`, `1d`, `now`, ISO 8601 (`2026-03-19T08:00:00`), or date-time strings (`2026-03-19 08:00`).

**Timezone:** The `--timezone` flag accepts IANA timezone names (e.g., `America/Chicago`). If omitted, your system's local timezone is used.

Active log files (`.gzo` extension -- files still being written to by CUCM) are automatically filtered out. Use `--include-active` to include them.

### download

Download files from a prior `select` by index, range, or all at once. Or fetch a specific file directly without a prior select.

```bash
# By index or range (from last select)
cisco-dime download 1,3,5
cisco-dime download 1-5
cisco-dime download --all

# By explicit path (no prior select needed)
cisco-dime download --file "/activelog/cm/trace/..." --host 10.0.0.1

# With options
cisco-dime download --all --output-dir ./logs
cisco-dime download --all --organize          # saves to ./hostname/2026-03-19/filename
cisco-dime download --all --decompress        # gunzips .gz files after download
```

### Built-in Presets

| Preset       | Service Log Name(s)                            |
| ------------ | ---------------------------------------------- |
| `sip-traces` | Cisco CallManager, Cisco CTIManager            |
| `cti-traces` | Cisco CTIManager                               |
| `curri-logs` | Cisco Extended Functions                       |
| `syslog`     | messages, CiscoSyslog                          |
| `tomcat`     | Tomcat, Tomcat Security                        |
| `oamp`       | Cisco Unified OS Admin, Cisco Unified CM Admin |
| `audit`      | Cisco Audit Logs                               |

Add custom presets with `cisco-dime config add-preset <name> --services "Svc1,Svc2"`.

### doctor

```bash
cisco-dime doctor
```

Check DIME connectivity and configuration health.

## Global Flags

| Flag                              | Description                                     |
| --------------------------------- | ----------------------------------------------- |
| `--format table\|json\|toon\|csv` | Output format (default: `table`)                |
| `--cluster <name>`                | Use a specific named cluster                    |
| `--host <host>`                   | Override config/env host                        |
| `--username <user>`               | Override config/env username                    |
| `--password <pass>`               | Override config/env password                    |
| `--insecure`                      | Skip TLS certificate verification               |
| `--concurrency <n>`               | Parallel operations (default: 5)                |
| `--output-dir <path>`             | Directory to save downloaded files              |
| `--organize`                      | Save files into `<host>/<date>/` subdirectories |
| `--decompress`                    | Gunzip `.gz` files after download               |
| `--include-active`                | Include active `.gzo` log files                 |
| `--no-audit`                      | Disable audit logging for this command          |
| `--debug`                         | Enable debug logging                            |
