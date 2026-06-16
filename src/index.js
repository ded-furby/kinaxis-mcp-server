#!/usr/bin/env node
/**
 * kinaxis-mcp-server
 * MCP Server for Kinaxis Maestro (RapidResponse)
 *
 * The first open-source MCP server for Kinaxis.
 * Yes, we checked. Genpact has one, but it is proprietary.
 * This one is MIT-licensed, because supply chains should be open.
 *
 * @author Federico Berrone
 * @license MIT
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";               // bundled with @modelcontextprotocol/sdk
import { KinaxisClient } from "./kinaxis-client.js";

//  Schemas 
const ScenarioSchema = z.object({
  Scope: z.enum(["Public", "Private"]).default("Public"),
  Name:  z.string(),
}).optional().describe("Scenario override. Omit to use default from env.");

const ColumnsSchema = z.array(z.string()).optional()
  .describe("Column names to include in results");

//  Server 
const server = new McpServer({
  name: "kinaxis-mcp-server",
  version: "0.1.0",
  description: "Query, export, import and manage Kinaxis Maestro supply chain data",
});

let client;
try {
  client = new KinaxisClient();
} catch (e) {
  console.error(`[kinaxis-mcp-server] ${e.message}`);
  console.error("Set KINAXIS_BASE_URL and credentials in .env or environment variables.");
  process.exit(1);
}

// helper: wrap tool handlers with consistent error handling
function toolResult(data) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}
function toolError(err) {
  const msg = err.details
    ? `${err.message}\n${JSON.stringify(err.details, null, 2)}`
    : err.message;
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}

// ═
//  TOOLS
// ═

//  Health 
server.tool(
  "health_check",
  "Verify connectivity and authentication to Kinaxis Maestro",
  {},
  async () => {
    try { return toolResult(await client.healthCheck()); }
    catch (e) { return toolError(e); }
  }
);

//  List Tables 
server.tool(
  "list_tables",
  "List all available Kinaxis tables with their update order. Use to discover table names for queries and exports.",
  {},
  async () => {
    try {
      const tables = await client.bulkTableOrder();
      const names = Object.keys(tables).sort();
      return toolResult({ totalTables: names.length, tables: names });
    } catch (e) { return toolError(e); }
  }
);

//  Query Table 
server.tool(
  "query_table",
  "Run a query against a Kinaxis table. Returns a query handle and total row count. Use fetch_query_results to get rows.",
  {
    table:    z.string().describe("Table name (e.g. 'Core::Currency', 'Core::Part')"),
    columns:  ColumnsSchema,
    scenario: ScenarioSchema,
  },
  async ({ table, columns, scenario }) => {
    try {
      const result = await client.queryCreate({
        table,
        columns,
        scenarios: scenario ? [scenario] : undefined,
      });
      return toolResult(result);
    } catch (e) { return toolError(e); }
  }
);

//  Fetch Query Results 
server.tool(
  "fetch_query_results",
  "Fetch rows from a previously created query handle. Supports pagination.",
  {
    queryHandle: z.string().describe("Query handle returned by query_table"),
    startRow:    z.number().default(0).describe("Starting row index (0-based)"),
    numRows:     z.number().default(100).describe("Number of rows to fetch (max ~10000)"),
  },
  async ({ queryHandle, startRow, numRows }) => {
    try {
      return toolResult(await client.queryFetch(queryHandle, startRow, numRows));
    } catch (e) { return toolError(e); }
  }
);

//  Close Query 
server.tool(
  "close_query",
  "Release a query handle to free server resources",
  {
    queryHandle: z.string().describe("Query handle to close"),
  },
  async ({ queryHandle }) => {
    try {
      await client.queryClose(queryHandle);
      return toolResult({ message: "Query closed successfully" });
    } catch (e) { return toolError(e); }
  }
);

//  Bulk Export ─
server.tool(
  "bulk_export",
  "Export data from a Kinaxis table using the Bulk API. Supports up to 500k rows per batch.",
  {
    table:    z.string().describe("Full table name (e.g. 'Core::Currency')"),
    fields:   z.array(z.string()).describe("Field names to export"),
    scenario: ScenarioSchema,
    numRows:  z.number().default(500).describe("Rows per batch (max 500000)"),
  },
  async ({ table, fields, scenario, numRows }) => {
    try {
      return toolResult(await client.bulkExport({
        table, fields, numRows,
        scenario: scenario || undefined,
      }));
    } catch (e) { return toolError(e); }
  }
);

//  Bulk Upload 
server.tool(
  "bulk_upload_init",
  "Initialize a bulk upload to a Kinaxis table (partial or full update)",
  {
    table:      z.string().describe("Target table name"),
    fields:     z.array(z.string()).describe("Field names for the upload"),
    scenario:   ScenarioSchema,
    updateType: z.enum(["Partial", "Full"]).default("Partial"),
  },
  async ({ table, fields, scenario, updateType }) => {
    try {
      return toolResult(await client.bulkUploadInit({
        table, fields, updateType,
        scenario: scenario || undefined,
      }));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "bulk_upload_data",
  "Upload rows of data to an active bulk upload handle",
  {
    uploadHandle: z.string().describe("Upload handle from bulk_upload_init"),
    rows:         z.array(z.array(z.any())).describe("Array of row arrays matching the fields order"),
  },
  async ({ uploadHandle, rows }) => {
    try {
      return toolResult(await client.bulkUploadData(uploadHandle, rows));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "bulk_upload_complete",
  "Finalize a bulk upload and trigger the data update",
  {
    uploadHandle: z.string().describe("Upload handle to complete"),
  },
  async ({ uploadHandle }) => {
    try {
      return toolResult(await client.bulkUploadComplete(uploadHandle));
    } catch (e) { return toolError(e); }
  }
);

//  Data Update ─
server.tool(
  "trigger_data_update",
  "Trigger a data update in Kinaxis Maestro",
  {
    scenario: ScenarioSchema,
  },
  async ({ scenario }) => {
    try {
      return toolResult(await client.dataUpdateTrigger(scenario || undefined));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "data_update_status",
  "Check the status of a running data update",
  {
    statusKey: z.string().describe("Status key from trigger_data_update"),
  },
  async ({ statusKey }) => {
    try {
      return toolResult(await client.dataUpdateStatus(statusKey));
    } catch (e) { return toolError(e); }
  }
);

//  Scripts ─
server.tool(
  "run_script",
  "Execute a Maestro script synchronously",
  {
    scope:      z.enum(["Public", "Private"]).describe("Script scope"),
    name:       z.string().describe("Script name"),
    parameters: z.record(z.any()).optional().describe("Script parameters as key-value pairs"),
  },
  async ({ scope, name, parameters }) => {
    try {
      return toolResult(await client.scriptRun(scope, name, parameters || {}));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "run_script_async",
  "Execute a Maestro script asynchronously (returns immediately with a job handle)",
  {
    scope:      z.enum(["Public", "Private"]).describe("Script scope"),
    name:       z.string().describe("Script name"),
    parameters: z.record(z.any()).optional().describe("Script parameters"),
  },
  async ({ scope, name, parameters }) => {
    try {
      return toolResult(await client.scriptRunAsync(scope, name, parameters || {}));
    } catch (e) { return toolError(e); }
  }
);

//  Workflows 
server.tool(
  "run_workflow",
  "Run a Maestro workflow",
  {
    scope: z.enum(["Public", "Private"]).describe("Workflow scope"),
    name:  z.string().describe("Workflow name"),
    input: z.record(z.any()).optional().describe("Workflow input parameters"),
  },
  async ({ scope, name, input }) => {
    try {
      return toolResult(await client.workflowRun(scope, name, input || {}));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "workflow_status",
  "Check the status of a running workflow",
  {
    scope: z.enum(["Public", "Private"]).describe("Workflow scope"),
    name:  z.string().describe("Workflow name"),
  },
  async ({ scope, name }) => {
    try {
      return toolResult(await client.workflowStatus(scope, name));
    } catch (e) { return toolError(e); }
  }
);

//  Workbook 
server.tool(
  "open_workbook",
  "Open a Kinaxis workbook to retrieve worksheet data",
  {
    workbook:  z.string().describe("Workbook name"),
    siteGroup: z.string().describe("Site group name"),
    scenario:  ScenarioSchema,
    filter:    z.string().optional().describe("Optional filter name"),
  },
  async ({ workbook, siteGroup, scenario, filter }) => {
    try {
      return toolResult(await client.workbookOpen({
        workbook, siteGroup, filter,
        scenario: scenario || undefined,
      }));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "read_worksheet",
  "Read data from an opened worksheet",
  {
    worksheetHandle: z.string().describe("Worksheet handle from open_workbook"),
    startRow:        z.number().default(0),
    numRows:         z.number().default(100),
  },
  async ({ worksheetHandle, startRow, numRows }) => {
    try {
      return toolResult(await client.worksheetRead({ worksheetHandle, startRow, numRows }));
    } catch (e) { return toolError(e); }
  }
);

server.tool(
  "import_worksheet",
  "Import data into a Kinaxis workbook worksheet",
  {
    workbook:  z.string().describe("Workbook name"),
    siteGroup: z.string().describe("Site group name"),
    scenario:  ScenarioSchema,
    data:      z.any().describe("Data to import (format depends on workbook configuration)"),
  },
  async ({ workbook, siteGroup, scenario, data }) => {
    try {
      return toolResult(await client.worksheetImport({
        workbook, siteGroup, data,
        scenario: scenario || undefined,
      }));
    } catch (e) { return toolError(e); }
  }
);

// 
//  START
// ═
const transport = new StdioServerTransport();
await server.connect(transport);
