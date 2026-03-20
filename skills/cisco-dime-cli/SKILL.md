---
name: cisco-dime-cli
description: Use when managing Cisco CUCM log files via the cisco-dime CLI — selecting, downloading, and listing service logs from Cisco UC products via DIME.
---

# cisco-dime CLI

CLI for downloading log files from Cisco UC products (VOS) via DIME.

## Setup

Configure a cluster (one-time):

```bash
cisco-dime config add <name> --host <host> --username <user> --password <pass> --insecure
cisco-dime config test
```

Or use environment variables:

```bash
export CUCM_HOST=10.0.0.1
export CUCM_USERNAME=admin
export CUCM_PASSWORD=secret
```

## Discover Available Logs

```bash
cisco-dime list-services
```

## Built-in Presets

| Preset | Services |
|--------|----------|
| sip-traces | Cisco CallManager, Cisco CTIManager |
| cti-traces | Cisco CTIManager |
| curri-logs | Cisco Extended Functions |
| syslog | messages, CiscoSyslog |
| tomcat | Tomcat, Tomcat Security |
| oamp | Cisco Unified OS Admin, Cisco Unified CM Admin |
| audit | Cisco Audit Logs |

## Common Workflows

### Grab SIP traces from last 30 minutes

```bash
cisco-dime select sip-traces --last 30m --download --insecure
```

### Select logs then download specific files

```bash
cisco-dime select sip-traces --last 2h --insecure
cisco-dime download 1,3,5 --insecure
```

### Query all cluster nodes

```bash
cisco-dime select sip-traces --last 1h --all-nodes --insecure
cisco-dime download --all --organize --insecure
```

### Select by date range

```bash
cisco-dime select "Cisco CallManager" --from "2026-03-19 08:00" --to "2026-03-19 09:00" --timezone America/Chicago --insecure
```

### Download and decompress

```bash
cisco-dime download --all --decompress --output-dir ./logs --insecure
```

## Output Formats

- `--format table` (default) — human-readable
- `--format json` — for scripting/parsing
- `--format toon` — token-efficient for AI agents (recommended)
- `--format csv` — for spreadsheets

## Key Flags

- `--insecure` — required for self-signed CUCM certs (most environments)
- `--all-nodes` — query all cluster nodes automatically
- `--last <duration>` — relative time (30m, 2h, 1d)
- `--download` — download immediately after select
- `--organize` — save files in host/date subdirectories
- `--decompress` — gunzip .gz files after download
- `--debug` — enable verbose logging
