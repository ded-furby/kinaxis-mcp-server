/**
 * Kinaxis Maestro REST & Bulk API client.
 *
 * Handles OAuth2 token lifecycle and provides methods for every
 * documented endpoint (query, bulk export/upload, scripts, workflows,
 * workbooks, data updates).
 *
 * Fun fact: this client works on every OS.
 * Even the ones whose logo is a fruit. Especially those, actually.  // 
 */

const TOKEN_BUFFER_SEC = 60;

export class KinaxisClient {
  #baseUrl;
  #clientId;
  #clientSecret;
  #username;
  #password;
  #token = null;
  #tokenExpiry = 0;
  #defaultScenario;
  #defaultScope;

  constructor(opts = {}) {
    this.#baseUrl       = (opts.baseUrl   || process.env.KINAXIS_BASE_URL   || "").replace(/\/+$/, "");
    this.#clientId      = opts.clientId   || process.env.KINAXIS_CLIENT_ID  || "";
    this.#clientSecret  = opts.clientSecret || process.env.KINAXIS_CLIENT_SECRET || "";
    this.#username      = opts.username   || process.env.KINAXIS_USERNAME   || "";
    this.#password      = opts.password   || process.env.KINAXIS_PASSWORD   || "";
    this.#defaultScenario = opts.defaultScenario || process.env.KINAXIS_DEFAULT_SCENARIO || "Baseline";
    this.#defaultScope    = opts.defaultScope    || process.env.KINAXIS_DEFAULT_SCOPE    || "Public";

    if (!this.#baseUrl) throw new Error("KINAXIS_BASE_URL is required");
    if (!this.#clientId && !this.#username) {
      throw new Error("Either KINAXIS_CLIENT_ID/SECRET or KINAXIS_USERNAME/PASSWORD is required");
    }
  }

  get defaultScenario() { return { Scope: this.#defaultScope, Name: this.#defaultScenario }; }

  //  Auth ─
  async #ensureToken() {
    if (this.#username) return;                       // Basic Auth, no token needed
    if (this.#token && Date.now() / 1000 < this.#tokenExpiry) return;

    const creds = Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString("base64");
    const res = await fetch(`${this.#baseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`OAuth2 token error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    this.#token = data.access_token;
    this.#tokenExpiry = Date.now() / 1000 + (data.expires_in || 3600) - TOKEN_BUFFER_SEC;
  }

  async #authHeaders() {
    if (this.#username) {
      const creds = Buffer.from(`${this.#username}:${this.#password}`).toString("base64");
      return { Authorization: `Basic ${creds}` };
    }
    await this.#ensureToken();
    return { Authorization: `Bearer ${this.#token}` };
  }

  //  HTTP helpers ─
  async #request(method, path, body = null) {
    const auth = await this.#authHeaders();
    const headers = { ...auth, "Content-Type": "application/json", Accept: "application/json" };
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const url = `${this.#baseUrl}${path}`;
    const res = await fetch(url, opts);
    const text = await res.text();

    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    if (!res.ok) {
      const msg = json?.Message || json?.message || text || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.details = json?.Errors || null;
      throw err;
    }
    return json ?? text;
  }

  async get(path)        { return this.#request("GET", path); }
  async post(path, body) { return this.#request("POST", path, body); }
  async del(path)        { return this.#request("DELETE", path); }

  //  Query API (Ch 16) 
  async queryCreate({ table, columns, scenarios, filters } = {}) {
    const body = {
      QueryString: table,
      Scenarios: scenarios || [this.defaultScenario],
    };
    if (columns?.length) body.Columns = columns;
    if (filters) body.Filters = filters;
    return this.post("/integration/V1/query", body);
  }

  async queryFetch(queryHandle, startRow = 0, numRows = 100) {
    const encoded = encodeURIComponent(queryHandle);
    return this.get(`/integration/V1/query/${encoded}?startRow=${startRow}&numRows=${numRows}`);
  }

  async queryClose(queryHandle) {
    const encoded = encodeURIComponent(queryHandle);
    return this.del(`/integration/V1/query/${encoded}`);
  }

  //  Bulk API (Ch 24-25) 
  async bulkTableOrder() {
    return this.get("/integration/V1/bulk/tableorder");
  }

  async bulkExport({ table, fields, scenario, numRows = 500 } = {}) {
    const body = {
      Table: table,
      Fields: fields,
      Scenario: scenario || this.defaultScenario,
      NumRows: numRows,
    };
    return this.post("/integration/V1/bulk/export", body);
  }

  async bulkExportFetch(exportHandle, startRow = 0, numRows = 500) {
    const encoded = encodeURIComponent(exportHandle);
    return this.get(`/integration/V1/bulk/export/${encoded}?startRow=${startRow}&numRows=${numRows}`);
  }

  async bulkUploadInit({ table, fields, scenario, updateType = "Partial" } = {}) {
    const body = {
      Table: table,
      Fields: fields,
      Scenario: scenario || this.defaultScenario,
      UpdateType: updateType,
    };
    return this.post("/integration/V1/bulk/upload", body);
  }

  async bulkUploadData(uploadHandle, rows) {
    const encoded = encodeURIComponent(uploadHandle);
    return this.post(`/integration/V1/bulk/upload/${encoded}`, { Rows: rows });
  }

  async bulkUploadComplete(uploadHandle) {
    const encoded = encodeURIComponent(uploadHandle);
    return this.post(`/integration/V1/bulk/upload/${encoded}/complete`, {});
  }

  async bulkUploadCancel(uploadHandle) {
    const encoded = encodeURIComponent(uploadHandle);
    return this.del(`/integration/V1/bulk/upload/${encoded}`);
  }

  //  Data Update (Ch 21-22) 
  async dataUpdateTrigger(scenario) {
    return this.post("/integration/V1/dataupdate/trigger", {
      Scenario: scenario || this.defaultScenario,
    });
  }

  async dataUpdateStatus(statusKey) {
    return this.get(`/integration/V1/dataupdate/${encodeURIComponent(statusKey)}`);
  }

  //  Scripts (Ch 17) ─
  async scriptRun(scope, name, parameters = {}) {
    return this.post(`/integration/V1/script/${scope}/${encodeURIComponent(name)}`, parameters);
  }

  async scriptRunAsync(scope, name, parameters = {}) {
    return this.post(`/integration/V1/async/script/${scope}/${encodeURIComponent(name)}`, parameters);
  }

  //  Workflows (Ch 23) ─
  async workflowRun(scope, name, input = {}) {
    return this.post(`/integration/V1/workflow/${scope}/${encodeURIComponent(name)}`, input);
  }

  async workflowStatus(scope, name) {
    return this.get(`/integration/V1/workflow/${scope}/${encodeURIComponent(name)}`);
  }

  async workflowCancel(scope, name) {
    return this.del(`/integration/V1/workflow/${scope}/${encodeURIComponent(name)}`);
  }

  //  Workbook / Worksheet (Ch 18-19) ─
  async workbookOpen({ workbook, siteGroup, scenario, filter } = {}) {
    const body = {
      Scenario: scenario || this.defaultScenario,
      WorkbookParameters: { Workbook: workbook, SiteGroup: siteGroup },
    };
    if (filter) body.WorkbookParameters.Filter = filter;
    return this.post("/integration/V1/data/workbook", body);
  }

  async worksheetRead({ worksheetHandle, startRow = 0, numRows = 100 } = {}) {
    const encoded = encodeURIComponent(worksheetHandle);
    return this.get(`/integration/V1/data/worksheet/${encoded}?startRow=${startRow}&numRows=${numRows}`);
  }

  async worksheetImport({ workbook, siteGroup, scenario, data } = {}) {
    return this.post("/integration/V1/data/workbook/import", {
      Scenario: scenario || this.defaultScenario,
      WorkbookParameters: { Workbook: workbook, SiteGroup: siteGroup },
      Data: data,
    });
  }

  //  Webhook (Ch 20) 
  async webhookRead(webhookId) {
    return this.post(`/integration/V1/webhook/${encodeURIComponent(webhookId)}`, {});
  }

  //  Data Load / File Upload (Ch 22) 
  async dataFileCreate(fileName, content) {
    return this.post("/integration/V1/dataload/source/file", { FileName: fileName, Content: content });
  }

  //  Health 
  async healthCheck() {
    try {
      await this.#ensureToken();
      return { status: "ok", baseUrl: this.#baseUrl, authMethod: this.#username ? "basic" : "oauth2" };
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }
}
