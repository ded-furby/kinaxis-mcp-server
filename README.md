# kinaxis-mcp-server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

The **first open-source** [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for
[Kinaxis Maestro](https://www.kinaxis.com) (formerly RapidResponse).

> **Note:** Genpact offers a proprietary Kinaxis MCP integration, but it is not open-source.
> This project is MIT-licensed so anyone can use, extend and contribute.

## What it does

Exposes Kinaxis Maestro REST & Bulk APIs as MCP tools that AI agents (Copilot, Claude, etc.)
can call to:

| Tool | Description |
|------|-------------|
| `health_check` | Verify connectivity and auth |
| `list_tables` | Discover all 800+ Kinaxis tables |
| `query_table` | Run a query against any table |
| `fetch_query_results` | Paginated row retrieval |
| `close_query` | Release query resources |
| `bulk_export` | Export up to 500k rows per batch |
| `bulk_upload_init` | Start a bulk data upload |
| `bulk_upload_data` | Push rows to an upload |
| `bulk_upload_complete` | Finalize upload & trigger update |
| `trigger_data_update` | Trigger a data update |
| `data_update_status` | Check data update progress |
| `run_script` | Execute Maestro scripts (sync) |
| `run_script_async` | Execute scripts asynchronously |
| `run_workflow` | Run Maestro workflows |
| `workflow_status` | Check workflow status |
| `open_workbook` | Open a workbook for data retrieval |
| `read_worksheet` | Read worksheet data |
| `import_worksheet` | Import data via workbook |

## Quick start

### Prerequisites

- Node.js >= 18
- A Kinaxis Maestro instance with REST API access
- OAuth2 client credentials **or** a web service user (Basic Auth)

### Install

```bash
git clone https://github.com/federicociro/kinaxis-mcp-server.git
cd kinaxis-mcp-server
npm install
cp .env.example .env
# Edit .env with your Kinaxis credentials
```

### Configure

Edit `.env`:

```env
KINAXIS_BASE_URL=https://your-region.kinaxis.net/YOUR_INSTANCE
KINAXIS_CLIENT_ID=your_oauth2_client_id
KINAXIS_CLIENT_SECRET=your_oauth2_client_secret
KINAXIS_DEFAULT_SCENARIO=Baseline
KINAXIS_DEFAULT_SCOPE=Public
```

Or use Basic Auth:

```env
KINAXIS_BASE_URL=https://your-region.kinaxis.net/YOUR_INSTANCE
KINAXIS_USERNAME=your_ws_user
KINAXIS_PASSWORD=your_ws_password
```

### Add to your MCP client

#### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "kinaxis": {
      "command": "node",
      "args": ["src/index.js"],
      "cwd": "/path/to/kinaxis-mcp-server",
      "env": {
        "KINAXIS_BASE_URL": "https://your-region.kinaxis.net/YOUR_INSTANCE",
        "KINAXIS_CLIENT_ID": "your_client_id",
        "KINAXIS_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

#### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kinaxis": {
      "command": "node",
      "args": ["/path/to/kinaxis-mcp-server/src/index.js"],
      "env": {
        "KINAXIS_BASE_URL": "https://your-region.kinaxis.net/YOUR_INSTANCE",
        "KINAXIS_CLIENT_ID": "your_client_id",
        "KINAXIS_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### Run standalone

```bash
npm start
```

## Authentication

The server supports two authentication methods:

1. **OAuth2 Client Credentials** (recommended): Register a client in Kinaxis Admin,
   provide `KINAXIS_CLIENT_ID` and `KINAXIS_CLIENT_SECRET`. Tokens are refreshed
   automatically.

2. **Basic Auth**: Use a Kinaxis web service user with `KINAXIS_USERNAME` and
   `KINAXIS_PASSWORD`. Simpler setup but credentials are sent with every request.

## Kinaxis API reference

This server implements endpoints from the
[Maestro Web Services Guide](https://www.kinaxis.com) (REST & Bulk APIs).
Place your copy of the Kinaxis documentation in the `docs/` folder (gitignored)
for local reference.

## Contributing

PRs welcome! Please:

1. Fork the repo
2. Create a feature branch (`feat/my-feature`)
3. Use [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a PR

## License

[MIT](LICENSE)  Federico Berrone, 2026
