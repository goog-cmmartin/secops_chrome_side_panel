/**
 * Google SecOps, Cloud Logging & Developer Knowledge Multi-Server MCP Client
 * Communicates with:
 * 1. Google Developer Knowledge MCP: https://developerknowledge.googleapis.com/mcp
 * 2. Google SecOps Remote MCP: https://{region}-chronicle.googleapis.com/mcp
 * 3. Google Cloud Logging Remote MCP: https://logging.googleapis.com/mcp
 * over Streamable HTTP JSON-RPC 2.0
 */

const DOCS_MCP_ENDPOINT = "https://developerknowledge.googleapis.com/mcp";
const LOGS_MCP_ENDPOINT = "https://logging.googleapis.com/mcp";
const MCP_PROTOCOL_VERSION = "2026-07-28";
const DEFAULT_SECOPS_CUSTOMER_ID = "";
const DEFAULT_SECOPS_PROJECT_ID = "";
const DEFAULT_SECOPS_REGION = "us";

// Combined Gemini Function Declarations for Developer Knowledge, SecOps & Cloud Logging Tools
const GEMINI_FUNCTION_DECLARATIONS = [
  // --- Google Developer Knowledge Documentation Tools ---
  {
    name: "search_documents",
    description: "Search official Google developer and product documentation, including Google SecOps (Chronicle), Google Cloud, UDM schemas, YARA-L rules, and APIs. Returns relevant documentation chunks and parent URLs.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Specific query string to search official documentation, e.g. Chronicle UDM search best practices or YARA-L regex syntax."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_documents",
    description: "Retrieve full markdown content of official Google documentation by parent resource name(s) returned from search_documents.",
    parameters: {
      type: "OBJECT",
      properties: {
        names: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of document parent names returned by search_documents. Format: documents/{uri_without_scheme}, e.g. documents/docs.cloud.google.com/chronicle/docs/soar/investigate/working-with-cases/how-to-close-cases"
        }
      },
      required: ["names"]
    }
  },

  // --- Google SecOps Remote MCP Tools (Chronicle Live Operations) ---
  {
    name: "udm_search",
    description: "Execute a live Unified Data Model (UDM) search query in Google SecOps Chronicle over an absolute ISO-8601 time range. Returns matching security events and log records.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "The UDM query string to execute, e.g. metadata.event_type = \"USER_LOGIN\""
        },
        startTime: {
          type: "STRING",
          description: "Start of time range in ISO 8601 format (e.g. 2026-09-28T00:00:00Z)."
        },
        endTime: {
          type: "STRING",
          description: "End of time range in ISO 8601 format (e.g. 2026-09-29T00:00:00Z)."
        },
        maxEvents: {
          type: "INTEGER",
          description: "Maximum number of event records to return (defaults to 100)."
        }
      },
      required: ["query", "startTime", "endTime"]
    }
  },
  {
    name: "translate_udm_query",
    description: "Translate a natural language question or requirement into a valid Google SecOps UDM search query expression with suggested time window.",
    parameters: {
      type: "OBJECT",
      properties: {
        naturalLanguageQuery: {
          type: "STRING",
          description: "Natural language description of what you are looking for."
        }
      },
      required: ["naturalLanguageQuery"]
    }
  },
  {
    name: "list_cases",
    description: "List SOAR investigation cases in Google SecOps with optional filter (e.g. status, priority, or time).",
    parameters: {
      type: "OBJECT",
      properties: {
        filter: {
          type: "STRING",
          description: "Optional filter expression for cases."
        },
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of cases to return."
        }
      }
    }
  },
  {
    name: "get_case",
    description: "Retrieve comprehensive details, priority, severity, assignee, and involved entities for a specific Google SecOps case.",
    parameters: {
      type: "OBJECT",
      properties: {
        caseId: {
          type: "STRING",
          description: "The numeric or string identifier of the case (e.g. 106565)."
        }
      },
      required: ["caseId"]
    }
  },
  {
    name: "list_case_alerts",
    description: "List all security alerts, detection rule firings, and indicators attached to a specific Google SecOps case.",
    parameters: {
      type: "OBJECT",
      properties: {
        caseId: {
          type: "STRING",
          description: "The numeric or string identifier of the case (e.g. 106565)."
        },
        filter: {
          type: "STRING",
          description: "Optional filter expression for alerts."
        }
      },
      required: ["caseId"]
    }
  },
  {
    name: "get_case_alert",
    description: "Retrieve detailed detection telemetry, events, and raw logs for a specific alert attached to a case.",
    parameters: {
      type: "OBJECT",
      properties: {
        caseId: {
          type: "STRING",
          description: "The case ID (e.g. 106616)."
        },
        caseAlertId: {
          type: "STRING",
          description: "The alert ID attached to the case (e.g. 402372)."
        },
        alertId: {
          type: "STRING",
          description: "Alias for caseAlertId."
        }
      },
      required: ["caseId"]
    }
  },
  {
    name: "create_case_comment",
    description: "Post a structured comment, investigation update, or closing note directly to a Google SecOps case wall / timeline.",
    parameters: {
      type: "OBJECT",
      properties: {
        caseId: {
          type: "STRING",
          description: "The numeric case ID (e.g. 106565)."
        },
        comment: {
          type: "STRING",
          description: "The Markdown or plain text content of the comment or note to add to the case timeline."
        }
      },
      required: ["caseId", "comment"]
    }
  },
  {
    name: "update_case",
    description: "Update properties of a Google SecOps case such as status, priority, or tags.",
    parameters: {
      type: "OBJECT",
      properties: {
        caseId: {
          type: "STRING",
          description: "The case ID."
        },
        status: {
          type: "STRING",
          description: "New case status (e.g. CLOSED, IN_PROGRESS, RESOLVED)."
        },
        priority: {
          type: "STRING",
          description: "New case priority (e.g. CRITICAL, HIGH, MEDIUM, LOW)."
        },
        closeReason: {
          type: "STRING",
          description: "Reason for closing the case if closing."
        }
      },
      required: ["caseId"]
    }
  },
  {
    name: "list_feeds",
    description: "List configured log ingestion feeds in Google SecOps and their operational health status.",
    parameters: {
      type: "OBJECT",
      properties: {
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of feeds to return."
        }
      }
    }
  },
  {
    name: "get_feed",
    description: "Retrieve full configuration details, source type, and ingestion health for a specific SecOps feed.",
    parameters: {
      type: "OBJECT",
      properties: {
        feedId: {
          type: "STRING",
          description: "Unique feed identifier."
        }
      },
      required: ["feedId"]
    }
  },
  {
    name: "list_rules",
    description: "List YARA-L detection rules configured in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of rules to return."
        }
      }
    }
  },
  {
    name: "validate_rule",
    description: "Validate the syntax and compilation of a YARA-L 2.0 detection rule text against the live Google SecOps engine without creating it.",
    parameters: {
      type: "OBJECT",
      properties: {
        rule: {
          type: "STRING",
          description: "Complete YARA-L 2.0 rule definition text to validate."
        }
      },
      required: ["rule"]
    }
  },
  {
    name: "list_data_tables",
    description: "List tabular reference datasets and threat intelligence tables available in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of data tables to return."
        }
      }
    }
  },
  {
    name: "list_security_alerts",
    description: "List recent security alerts generated in Google SecOps Chronicle SIEM with optional time range and status filter.",
    parameters: {
      type: "OBJECT",
      properties: {
        startTime: {
          type: "STRING",
          description: "Start of time range in ISO 8601 format."
        },
        endTime: {
          type: "STRING",
          description: "End of time range in ISO 8601 format."
        },
        maxAlerts: {
          type: "INTEGER",
          description: "Maximum number of alerts to return (defaults to 10)."
        },
        statusFilter: {
          type: "STRING",
          description: "Filter query (e.g. feedbackSummary.status != \"CLOSED\")."
        }
      }
    }
  },
  {
    name: "get_security_alert",
    description: "Retrieve comprehensive details, rule findings, and metadata for a specific security alert in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        alertId: {
          type: "STRING",
          description: "The unique alert identifier."
        }
      },
      required: ["alertId"]
    }
  },
  {
    name: "update_security_alert",
    description: "Update the status or severity of a security alert in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        alertId: {
          type: "STRING",
          description: "The alert ID to update."
        },
        status: {
          type: "STRING",
          description: "New status for the alert (e.g. CLOSED, OPEN, IN_PROGRESS)."
        },
        severity: {
          type: "STRING",
          description: "New severity for the alert (e.g. CRITICAL, HIGH, MEDIUM, LOW)."
        }
      },
      required: ["alertId"]
    }
  },
  {
    name: "list_rule_detections",
    description: "List historical rule detection firings for a specific YARA-L rule in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        ruleId: {
          type: "STRING",
          description: "Unique rule identifier."
        },
        startTime: {
          type: "STRING",
          description: "Start time in ISO 8601 format."
        },
        endTime: {
          type: "STRING",
          description: "End time in ISO 8601 format."
        },
        maxDetections: {
          type: "INTEGER",
          description: "Maximum number of detections to return."
        }
      },
      required: ["ruleId"]
    }
  },
  {
    name: "search_raw_logs",
    description: "Search ingested raw telemetry or event logs in Google SecOps across a time range.",
    parameters: {
      type: "OBJECT",
      properties: {
        baselineQuery: {
          type: "STRING",
          description: "The raw log search query string."
        },
        startTime: {
          type: "STRING",
          description: "Start time in ISO 8601 format."
        },
        endTime: {
          type: "STRING",
          description: "End time in ISO 8601 format."
        },
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of raw log records to return."
        }
      },
      required: ["baselineQuery", "startTime", "endTime"]
    }
  },
  {
    name: "get_investigation_by_id",
    description: "Retrieve findings, summary, and verdict of an automated AI investigation in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        investigationId: {
          type: "STRING",
          description: "Unique investigation identifier."
        }
      },
      required: ["investigationId"]
    }
  },
  {
    name: "get_alert_latest_investigation",
    description: "Retrieve the most recent automated AI investigation associated with a specific alert.",
    parameters: {
      type: "OBJECT",
      properties: {
        alertId: {
          type: "STRING",
          description: "The alert ID."
        }
      },
      required: ["alertId"]
    }
  },
  {
    name: "trigger_investigation",
    description: "Trigger a new autonomous AI investigation for a security alert in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        alertId: {
          type: "STRING",
          description: "The alert ID to investigate."
        }
      },
      required: ["alertId"]
    }
  },
  {
    name: "run_parser",
    description: "Test an ingestion log parser against raw log text in Google SecOps to verify UDM mapping and extraction.",
    parameters: {
      type: "OBJECT",
      properties: {
        logType: {
          type: "STRING",
          description: "Log type identifier (e.g. CS_EDR, GCP_CLOUDAUDIT)."
        },
        logText: {
          type: "STRING",
          description: "Sample raw log message text to parse."
        }
      },
      required: ["logType", "logText"]
    }
  },
  {
    name: "create_feed",
    description: "Create a new log ingestion feed in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        displayName: {
          type: "STRING",
          description: "Display name for the feed."
        },
        feedSourceType: {
          type: "STRING",
          description: "Source type (e.g. AMAZON_S3_V2, HTTPS_PUSH_GOOGLE_CLOUD_PUBSUB, API)."
        },
        logType: {
          type: "STRING",
          description: "Chronicle log type identifier."
        }
      },
      required: ["displayName", "feedSourceType", "logType"]
    }
  },
  {
    name: "update_feed",
    description: "Update configuration or state of an existing log ingestion feed in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        feedId: {
          type: "STRING",
          description: "The feed identifier."
        },
        displayName: {
          type: "STRING",
          description: "New display name."
        },
        state: {
          type: "STRING",
          description: "Target state (e.g. ACTIVE, INACTIVE)."
        }
      },
      required: ["feedId"]
    }
  },
  {
    name: "enable_feed",
    description: "Enable an existing log ingestion feed in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        feedId: {
          type: "STRING",
          description: "The feed identifier to enable."
        }
      },
      required: ["feedId"]
    }
  },
  {
    name: "disable_feed",
    description: "Disable an existing log ingestion feed in Google SecOps.",
    parameters: {
      type: "OBJECT",
      properties: {
        feedId: {
          type: "STRING",
          description: "The feed identifier to disable."
        }
      },
      required: ["feedId"]
    }
  },
  {
    name: "summarize_entity",
    description: "Summarize entity profile, risk score, first/last seen, and indicators for an IP, user, or hostname.",
    parameters: {
      type: "OBJECT",
      properties: {
        entityId: {
          type: "STRING",
          description: "The entity identifier (IP, username, hostname, or hash)."
        },
        entityType: {
          type: "STRING",
          description: "Optional entity type (e.g. IP_ADDRESS, USER, ASSET)."
        }
      },
      required: ["entityId"]
    }
  },
  {
    name: "search_entity",
    description: "Search the Google SecOps UDM entity graph for entities matching a keyword or criteria.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Search query for entity lookup."
        },
        entityType: {
          type: "STRING",
          description: "Optional entity type."
        },
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of entities to return."
        }
      },
      required: ["query"]
    }
  },
  {
    name: "generate_synthetic_events",
    description: "Generate synthetic UDM events in Google SecOps to test detection rules.",
    parameters: {
      type: "OBJECT",
      properties: {
        ruleId: {
          type: "STRING",
          description: "The rule ID to generate test events for."
        },
        count: {
          type: "INTEGER",
          description: "Number of events to generate (defaults to 5)."
        }
      },
      required: ["ruleId"]
    }
  },

  // --- Google Cloud Logging Remote MCP Tools (GCP Infrastructure & Audit Telemetry) ---
  {
    name: "list_log_entries",
    description: "Search and retrieve Google Cloud Logging entries (Cloud Audit Logs, VPC flow logs, IAM modification logs, application logs, system events) using the Cloud Logging query language filter. Can filter by severity, resource type, timestamp, or payload text.",
    parameters: {
      type: "OBJECT",
      properties: {
        filter: {
          type: "STRING",
          description: "Cloud Logging query language filter, e.g. 'severity >= ERROR' or 'protoPayload.methodName =~ \"SetIamPolicy\"' or 'resource.type = \"gce_instance\"'."
        },
        orderBy: {
          type: "STRING",
          description: "Sorting order: 'timestamp desc' (newest first, default) or 'timestamp asc' (oldest first)."
        },
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of log entries to retrieve (default: 20)."
        },
        resourceNames: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "List of resource names to query, e.g. ['projects/YOUR_PROJECT_ID']. Automatically populated from active GCP Project if omitted."
        }
      }
    }
  },
  {
    name: "list_log_names",
    description: "List log names available in the Google Cloud project (e.g. cloudaudit.googleapis.com/activity, syslog, compute.googleapis.com).",
    parameters: {
      type: "OBJECT",
      properties: {
        parent: {
          type: "STRING",
          description: "Resource parent name, e.g. 'projects/YOUR_PROJECT_ID'. Automatically populated if omitted."
        },
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of log names to return."
        }
      }
    }
  },
  {
    name: "list_buckets",
    description: "List Google Cloud Logging storage buckets (e.g. _Default, _Required, security log sinks) in the project.",
    parameters: {
      type: "OBJECT",
      properties: {
        parent: {
          type: "STRING",
          description: "Resource parent name, e.g. 'projects/YOUR_PROJECT_ID/locations/-'. Automatically populated if omitted."
        },
        pageSize: {
          type: "INTEGER",
          description: "Maximum number of buckets to return."
        }
      }
    }
  },
  {
    name: "get_bucket",
    description: "Get details and retention configuration of a specific Google Cloud Logging bucket.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: {
          type: "STRING",
          description: "Full resource name of the bucket, e.g. 'projects/YOUR_PROJECT_ID/locations/global/buckets/_Default'."
        }
      },
      required: ["name"]
    }
  },
  {
    name: "list_views",
    description: "List log views defined on a Cloud Logging bucket.",
    parameters: {
      type: "OBJECT",
      properties: {
        parent: {
          type: "STRING",
          description: "Full resource name of the bucket parent, e.g. 'projects/YOUR_PROJECT_ID/locations/global/buckets/_Default'."
        }
      },
      required: ["parent"]
    }
  },
  {
    name: "get_view",
    description: "Get details and filter boundaries of a specific Cloud Logging view.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: {
          type: "STRING",
          description: "Full resource name of the view, e.g. 'projects/YOUR_PROJECT_ID/locations/global/buckets/_Default/views/_AllLogs'."
        }
      },
      required: ["name"]
    }
  }
];

// Set of tool names that belong to Google Developer Knowledge
const DOCS_TOOLS = new Set(["search_documents", "get_documents"]);

// Set of tool names that belong to Google Cloud Logging Remote MCP
const LOGGING_TOOLS = new Set([
  "list_log_entries",
  "list_log_names",
  "list_buckets",
  "get_bucket",
  "list_views",
  "get_view"
]);

window.SecOpsMcpClient = {
  /**
   * Return Gemini tool definitions for function calling, filtered by user settings and mode
   * @param {Object} settings - User settings from storage
   * @param {string} [targetMcpMode="all"] - "all", "help" (Docs MCP only), or "action" (SecOps MCP only)
   */
  getGeminiTools(settings = {}, targetMcpMode = "all") {
    let declarations = GEMINI_FUNCTION_DECLARATIONS;
    if (settings.enableMcp === false) {
      declarations = declarations.filter((d) => !DOCS_TOOLS.has(d.name));
    }
    if (settings.enableSecOpsMcp === false) {
      declarations = declarations.filter((d) => DOCS_TOOLS.has(d.name) || LOGGING_TOOLS.has(d.name));
    }
    if (settings.enableLoggingMcp === false) {
      declarations = declarations.filter((d) => !LOGGING_TOOLS.has(d.name));
    }

    // Filter tools based on Help vs Action mode
    if (targetMcpMode === "help") {
      // Developer Knowledge MCP only (documentation & guidance)
      declarations = declarations.filter((d) => DOCS_TOOLS.has(d.name));
    } else if (targetMcpMode === "action") {
      // SecOps MCP & Cloud Logging MCP (actions & live operations)
      declarations = declarations.filter((d) => !DOCS_TOOLS.has(d.name));
    }

    if (declarations.length === 0) return undefined;
    return [
      {
        functionDeclarations: declarations
      }
    ];
  },

  /**
   * Extract custom headers defined by tool input schema using the x-mcp-header property (MCP 2026-07-28).
   * Mirrors designated argument values into Mcp-Param-{HeaderName} HTTP headers.
   */
  extractCustomHeaders(toolName, callArgs = {}, context = {}) {
    const customHeaders = {};
    if (!callArgs || typeof callArgs !== "object") callArgs = {};

    // 1. Look up schema from GEMINI_FUNCTION_DECLARATIONS
    const decl = GEMINI_FUNCTION_DECLARATIONS.find((d) => d.name === toolName);
    const properties = decl?.parameters?.properties || {};

    for (const [propName, propDef] of Object.entries(properties)) {
      if (propDef && propDef["x-mcp-header"]) {
        const headerSuffix = propDef["x-mcp-header"];
        const argValue = callArgs[propName];
        if (argValue !== undefined && argValue !== null) {
          // Primitive types: string, integer, boolean (RFC 9110 token safe)
          if (typeof argValue === "string" || typeof argValue === "number" || typeof argValue === "boolean") {
            const headerName = `Mcp-Param-${headerSuffix}`;
            customHeaders[headerName] = String(argValue);
          }
        }
      }
    }

    // 2. Standard Google Cloud parameter mirroring (Region, Project) if designated in context or args
    if (!customHeaders["Mcp-Param-Project"]) {
      const proj = callArgs.projectId || callArgs.project || context.projectId;
      if (proj && typeof proj === "string") {
        customHeaders["Mcp-Param-Project"] = proj;
      }
    }
    if (!customHeaders["Mcp-Param-Region"]) {
      const reg = callArgs.region || context.region;
      if (reg && typeof reg === "string") {
        customHeaders["Mcp-Param-Region"] = reg;
      }
    }

    return customHeaders;
  },

  /**
   * Determine the appropriate remote MCP endpoint for a tool call
   */
  getEndpointForTool(toolName, region = DEFAULT_SECOPS_REGION) {
    if (DOCS_TOOLS.has(toolName)) {
      return DOCS_MCP_ENDPOINT;
    }
    if (LOGGING_TOOLS.has(toolName)) {
      return LOGS_MCP_ENDPOINT;
    }
    const safeRegion = (region || DEFAULT_SECOPS_REGION).toLowerCase();
    return `https://${safeRegion}-chronicle.googleapis.com/mcp`;
  },

  /**
   * Execute an MCP tool via JSON-RPC 2.0 POST over Streamable HTTP
   * @param {string} toolName
   * @param {object} args
   * @param {string} token - OAuth Bearer Token
   * @param {string} project - Google Cloud Project ID
   * @param {AbortSignal} [signal] - Optional abort signal
   */
  async callTool(toolName, args = {}, token, project = DEFAULT_SECOPS_PROJECT_ID, signal = null) {
    // Read extension settings for overrides
    let settings = {};
    if (window.SecOpsAuthService?.getSettings) {
      settings = await window.SecOpsAuthService.getSettings();
    }

    const region = settings.secopsRegion || DEFAULT_SECOPS_REGION;
    const customerId = settings.secopsCustomerId || DEFAULT_SECOPS_CUSTOMER_ID;
    const projectId = project || settings.gcpProject || DEFAULT_SECOPS_PROJECT_ID;

    const isDocs = DOCS_TOOLS.has(toolName);
    const isLogging = LOGGING_TOOLS.has(toolName);
    const targetEndpoint = this.getEndpointForTool(toolName, region);

    const callArgs = { ...args };
    if (isLogging) {
      if (!projectId) {
        throw new Error(
          "Google Cloud Project ID is not configured. Please open Settings (⚙️) to enter your Project ID for Cloud Logging."
        );
      }
      if (toolName === "list_log_entries") {
        if (!callArgs.resourceNames || !Array.isArray(callArgs.resourceNames) || callArgs.resourceNames.length === 0) {
          callArgs.resourceNames = [`projects/${projectId}`];
        }
        if (!callArgs.orderBy) {
          callArgs.orderBy = "timestamp desc";
        }
        if (!callArgs.pageSize) {
          callArgs.pageSize = 20;
        }
      } else if (toolName === "list_log_names") {
        if (!callArgs.parent) {
          callArgs.parent = `projects/${projectId}`;
        }
      } else if (toolName === "list_buckets") {
        if (!callArgs.parent) {
          callArgs.parent = `projects/${projectId}/locations/-`;
        }
      }
    } else if (!isDocs) {
      if (!callArgs.projectId) callArgs.projectId = projectId;
      if (!callArgs.customerId) callArgs.customerId = customerId;
      if (!callArgs.region) callArgs.region = region;

      if (!callArgs.customerId && !callArgs.projectId) {
        throw new Error(
          "SecOps tenant credentials are not configured. Please open Settings (⚙️) to configure your Google Cloud Project ID and SecOps Customer ID."
        );
      }

      // Auto-populate default ISO 8601 time range for time-bounded queries when omitted by model
      if (toolName === "udm_search" || toolName === "search_raw_logs" || toolName === "list_rule_detections") {
        if (!callArgs.endTime) {
          callArgs.endTime = new Date().toISOString();
        }
        if (!callArgs.startTime) {
          // Default to last 24 hours to balance query speed and telemetry coverage
          const endMs = new Date(callArgs.endTime).getTime() || Date.now();
          callArgs.startTime = new Date(endMs - 24 * 60 * 60 * 1000).toISOString();
        }
      }

      // Normalize caseId aliases if the model passed case_id or id
      if (toolName === "get_case" || toolName === "list_case_alerts" || toolName === "get_case_alert") {
        if (!callArgs.caseId && callArgs.case_id) {
          callArgs.caseId = callArgs.case_id;
          delete callArgs.case_id;
        }
        if (!callArgs.caseId && callArgs.id) {
          callArgs.caseId = callArgs.id;
        }
        if (callArgs.caseId && typeof callArgs.caseId === "string") {
          callArgs.caseId = callArgs.caseId.replace(/^(?:case\s*#?|#)\s*/i, "").trim();
        }
      }

      // Normalize caseAlertId aliases for get_case_alert
      if (toolName === "get_case_alert") {
        if (!callArgs.caseAlertId && callArgs.alertId) {
          callArgs.caseAlertId = callArgs.alertId;
        } else if (!callArgs.caseAlertId && callArgs.alert_id) {
          callArgs.caseAlertId = callArgs.alert_id;
        } else if (!callArgs.caseAlertId && callArgs.id) {
          callArgs.caseAlertId = callArgs.id;
        }
        if (callArgs.caseAlertId) {
          callArgs.caseAlertId = String(callArgs.caseAlertId).replace(/^(?:alert\s*#?|#)\s*/i, "").trim();
        }
      }

      // Detect model misrouting: numeric case ID passed to list_rule_detections
      if (toolName === "list_rule_detections") {
        const rawRule = callArgs.ruleId || callArgs.rule_id || "";
        const numericMatch = String(rawRule).trim().match(/^(?:case\s*#?|#)?\s*(\d+)$/i);
        if (numericMatch) {
          const caseId = numericMatch[1];
          return {
            error: `'${rawRule}' is a SecOps Case ID, not a YARA-L rule ID (which starts with 'ru_'). Call get_case or list_case_alerts with caseId: '${caseId}'.`
          };
        }
      }
    } else if (toolName === "get_documents") {
      // Auto-normalize document names: model may pass without 'documents/' or 'docs.cloud.google.com/'
      let rawNames = callArgs.names || (callArgs.name ? [callArgs.name] : []);
      if (!Array.isArray(rawNames)) rawNames = [rawNames];
      callArgs.names = rawNames.map((n) => {
        if (!n || typeof n !== "string") return n;
        let clean = n.trim().replace(/^https?:\/\//, "");
        if (!clean.startsWith("documents/")) {
          if (!clean.startsWith("docs.cloud.google.com/")) {
            clean = `docs.cloud.google.com/${clean}`;
          }
          clean = `documents/${clean}`;
        }
        return clean;
      });
      delete callArgs.name;
    } else if (toolName === "search_documents") {
      if (!callArgs.query && callArgs.q) {
        callArgs.query = callArgs.q;
        delete callArgs.q;
      }
    }

    // Stateless Core MCP 2026-07-28 request payload with _meta parameter
    const payload = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientInfo": {
            name: "SecOpsSidePanel",
            version: "1.2.21"
          }
        },
        name: toolName,
        arguments: callArgs
      }
    };

    // Standard Request Headers per MCP 2026-07-28 Streamable HTTP specification
    const headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      "Mcp-Method": "tools/call",
      "Mcp-Name": toolName,
      "X-goog-user-project": projectId
    };

    // Mirror parameter headers per MCP 2026-07-28 x-mcp-header specification
    const customParamHeaders = this.extractCustomHeaders(toolName, callArgs, { projectId, region });
    Object.assign(headers, customParamHeaders);

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(targetEndpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
        signal: signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[MCP] Tool call ${toolName} HTTP ${response.status}: ${errorText}`);
        if ((response.status === 401 || response.status === 403) && errorText.includes("insufficient authentication scopes")) {
          if (token && window.SecOpsAuthService?.clearAuthToken) {
            await window.SecOpsAuthService.clearAuthToken(token);
          }
        }
        return { error: `MCP error HTTP ${response.status}: ${errorText}` };
      }

      const json = await response.json();
      if (json.error) {
        console.warn(`[MCP] Tool ${toolName} RPC error:`, json.error);
        return { error: json.error.message || "MCP RPC error" };
      }

      // Check for MCP tool execution errors inside response content
      const contentList = json.result?.content || [];
      if (json.result?.isError) {
        const errText = contentList.map((c) => c.text).join(" ");
        if (errText.includes("insufficient authentication scopes") && token && window.SecOpsAuthService?.clearAuthToken) {
          await window.SecOpsAuthService.clearAuthToken(token);
        }
        console.warn(`[MCP] Tool ${toolName} execution error:`, errText);
        return { error: errText || "MCP execution error" };
      }

      let parsedOutput = null;
      if (contentList.length > 0 && contentList[0].text) {
        try {
          parsedOutput = JSON.parse(contentList[0].text);
        } catch {
          parsedOutput = { content: contentList[0].text };
        }
      } else {
        parsedOutput = json.result || {};
      }

      // Evaluate and patch SecOps MCP tool response to prune massive nested objects and prevent schema timeouts
      return this.patchToolResponse(toolName, parsedOutput);
    } catch (err) {
      if (err.name === "AbortError") {
        throw err;
      }
      console.error(`[MCP] Failed to call tool ${toolName}:`, err);
      return { error: err.message };
    }
  },

  /**
   * Universal safety pruner that flattens and bounds nested response objects
   * preventing Vertex AI / Gemini schema flattening limits and timeouts.
   */
  pruneDeepObject(obj, maxDepth = 4, currentDepth = 0) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") {
      if (typeof obj === "string" && obj.length > 1000) {
        return obj.slice(0, 1000) + "... [truncated]";
      }
      return obj;
    }

    if (currentDepth >= maxDepth) {
      if (Array.isArray(obj)) {
        return `[Array of ${obj.length} items]`;
      }
      const keys = Object.keys(obj);
      return `[Object with ${keys.length} keys: ${keys.slice(0, 5).join(", ")}]`;
    }

    if (Array.isArray(obj)) {
      const maxItems = 15;
      return obj.slice(0, maxItems).map((item) => this.pruneDeepObject(item, maxDepth, currentDepth + 1));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;
      if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      result[key] = this.pruneDeepObject(value, maxDepth, currentDepth + 1);
    }
    return result;
  },

  /**
   * Evaluates and normalizes list_feeds response
   */
  patchListFeeds(data) {
    const rawFeeds = data.feeds || (Array.isArray(data) ? data : []);
    const feeds = rawFeeds.slice(0, 30).map((f) => {
      if (!f || typeof f !== "object") return f;
      const details = f.details || {};
      let activeSettings = null;
      for (const [k, v] of Object.entries(details)) {
        if (k.endsWith("Settings") && typeof v === "object" && v && Object.keys(v).length > 0) {
          activeSettings = { [k]: v };
          break;
        }
      }
      const feedId = f.uid || f.referenceId || f.name?.split("/").pop();
      let logType = details.logType || "";
      if (logType.includes("/")) logType = logType.split("/").pop();

      const item = {
        feedId,
        displayName: f.displayName,
        feedSourceType: details.feedSourceType,
        logType,
        state: f.state,
        lastFeedInitiationTime: f.lastFeedInitiationTime
      };
      if (activeSettings) item.settings = activeSettings;
      return item;
    });

    return {
      totalFeeds: rawFeeds.length,
      returnedFeedsCount: feeds.length,
      feeds
    };
  },

  /**
   * Evaluates and normalizes single feed operations
   */
  patchFeedOperation(toolName, data) {
    const feed = data.feed || data;
    if (!feed || typeof feed !== "object") {
      return { status: "SUCCESS", operation: toolName, raw: String(data) };
    }
    const details = feed.details || {};
    let activeSettings = null;
    for (const [k, v] of Object.entries(details)) {
      if (k.endsWith("Settings") && typeof v === "object" && v && Object.keys(v).length > 0) {
        activeSettings = { [k]: v };
        break;
      }
    }
    const feedId = feed.uid || feed.referenceId || feed.name?.split("/").pop();
    let logType = details.logType || "";
    if (logType.includes("/")) logType = logType.split("/").pop();

    return {
      operation: toolName,
      status: feed.state || "SUCCESS",
      feedId,
      displayName: feed.displayName,
      feedSourceType: details.feedSourceType,
      logType,
      state: feed.state,
      lastFeedInitiationTime: feed.lastFeedInitiationTime,
      activeSettings: activeSettings || undefined
    };
  },

  /**
   * Evaluates and normalizes udm_search response
   */
  patchUdmSearch(data) {
    const rawEvents = data.events || (Array.isArray(data) ? data : []);
    const events = rawEvents.slice(0, 15).map((e) => {
      if (!e || typeof e !== "object") return e;
      const meta = e.metadata || {};
      const principal = e.principal || {};
      const target = e.target || {};
      const network = e.network || {};
      const secResults = e.securityResult || [];

      const secRes = secResults.map((sr) => ({
        action: sr.action,
        severity: sr.severity,
        ruleName: sr.ruleName || sr.ruleId
      }));

      const item = {
        timestamp: meta.eventTimestamp || meta.collectedTimestamp,
        eventType: meta.eventType,
        productName: meta.productName
      };

      if (Object.keys(principal).length > 0) {
        item.principal = {
          ip: principal.ip,
          hostname: principal.hostname,
          user: principal.user?.userid
        };
      }
      if (Object.keys(target).length > 0) {
        item.target = {
          ip: target.ip,
          hostname: target.hostname,
          user: target.user?.userid,
          file: target.file?.fullPath
        };
      }
      if (Object.keys(network).length > 0) {
        item.network = {
          direction: network.direction,
          ipProtocol: network.ipProtocol,
          sessionDuration: network.sessionDuration
        };
      }
      if (secRes.length > 0) {
        item.securityResult = secRes;
      }
      return item;
    });

    return {
      totalEventsMatched: rawEvents.length,
      returnedCount: events.length,
      truncated: rawEvents.length > 15,
      events
    };
  },

  /**
   * Evaluates and normalizes search_raw_logs response
   */
  patchSearchRawLogs(data) {
    const rawLogs = data.rawLogs || data.logs || (Array.isArray(data) ? data : []);
    const logs = rawLogs.slice(0, 15).map((l) => {
      if (typeof l === "object" && l) {
        let snippet = l.rawText || l.logText || JSON.stringify(l);
        if (snippet && snippet.length > 300) {
          snippet = snippet.slice(0, 300) + "... [truncated]";
        }
        let logType = l.logType;
        if (typeof logType === "object" && logType) {
          logType = logType.displayName || logType.name?.split("/").pop();
        }
        return {
          timestamp: l.timestamp || l.collectionTime,
          logType,
          snippet
        };
      }
      return { snippet: String(l).slice(0, 300) };
    });

    return {
      totalLogsMatched: rawLogs.length,
      returnedCount: logs.length,
      truncated: rawLogs.length > 15,
      logs
    };
  },

  /**
   * Evaluates and normalizes list_security_alerts, get_security_alert, update_security_alert
   */
  patchSecurityAlerts(toolName, data) {
    let alertsList = [];
    if (data && typeof data === "object") {
      if (data.alerts && typeof data.alerts === "object" && Array.isArray(data.alerts.alerts)) {
        alertsList = data.alerts.alerts;
      } else if (Array.isArray(data.alerts)) {
        alertsList = data.alerts;
      } else if (data.alert) {
        alertsList = [data.alert];
      } else {
        alertsList = [data];
      }
    } else if (Array.isArray(data)) {
      alertsList = data;
    }

    const alerts = alertsList.slice(0, 15).map((a) => {
      if (!a || typeof a !== "object") return a;
      const detections = a.detection || [];
      const firstDet = detections[0] || {};
      const fb = a.feedbackSummary || {};

      const alertId = a.id || a.name?.split("/").pop();
      const ruleName = firstDet.ruleName || a.ruleName || a.displayName;
      const ruleId = firstDet.ruleId || a.ruleId;

      let eventCount = (a.events || []).length;
      if (eventCount === 0 && firstDet.events) {
        eventCount = firstDet.events.length;
      }

      return {
        alertId,
        ruleName,
        ruleId,
        createdTime: a.createdTime || firstDet.detectionTime,
        status: fb.status || a.status,
        severity: fb.severityDisplay || a.severity,
        caseName: a.caseName || a.caseId,
        matchedEventsCount: eventCount,
        summary: a.summary || a.detectionSummary
      };
    });

    if ((toolName === "get_security_alert" || toolName === "update_security_alert") && alerts.length > 0) {
      return alerts[0];
    }

    return {
      totalAlerts: alertsList.length,
      returnedCount: alerts.length,
      alerts
    };
  },

  /**
   * Evaluates and normalizes list_rule_detections response
   */
  patchListRuleDetections(data) {
    const rawDetections = data.detections || (Array.isArray(data) ? data : []);
    const detections = rawDetections.slice(0, 15).map((d) => {
      if (!d || typeof d !== "object") return d;
      const ruleObj = d.rule || {};
      const ruleId = d.ruleId || ruleObj.id;
      const ruleName = d.ruleName || ruleObj.name;
      return {
        detectionTime: d.detectionTime,
        ruleId,
        ruleName,
        alertState: d.alertState,
        url: d.url,
        summary: d.summary
      };
    });

    return {
      totalDetections: rawDetections.length,
      returnedCount: detections.length,
      detections
    };
  },

  /**
   * Evaluates and normalizes investigation responses
   */
  patchInvestigation(toolName, data) {
    const inv = data.investigation || data;
    if (!inv || typeof inv !== "object") {
      return { status: "SUCCESS", operation: toolName, raw: String(data) };
    }

    const rawFindings = inv.findings || [];
    const findings = rawFindings.slice(0, 10).map((f) => {
      if (!f || typeof f !== "object") return f;
      let desc = f.description || "";
      if (typeof desc === "string" && desc.length > 300) {
        desc = desc.slice(0, 300) + "... [truncated]";
      }
      return {
        title: f.title,
        severity: f.severity,
        description: desc
      };
    });

    let summary = inv.summary || inv.analysis || "";
    if (typeof summary === "string" && summary.length > 500) {
      summary = summary.slice(0, 500) + "... [truncated]";
    }

    return {
      investigationId: inv.id || inv.investigationId,
      status: inv.status || inv.state,
      verdict: inv.verdict || inv.assessment,
      summary,
      createdTime: inv.createdTime || inv.createTime,
      findingsCount: rawFindings.length,
      findings,
      recommendedActions: (inv.recommendations || inv.recommendedActions || []).slice(0, 5)
    };
  },

  /**
   * Evaluates and normalizes run_parser response
   */
  patchRunParser(data) {
    if (!data || typeof data !== "object") {
      return { status: "SUCCESS", raw: String(data) };
    }
    const parsed = data.parsedEvents || data.events || [];
    const sampleEvent = parsed[0] ? this.pruneDeepObject(parsed[0], 3) : undefined;
    return {
      status: data.status || (parsed.length > 0 ? "SUCCESS" : "NO_EVENTS_PARSED"),
      parsedEventsCount: parsed.length,
      sampleParsedEvent: sampleEvent,
      errors: data.errors || data.errorMessages
    };
  },

  /**
   * Evaluates and normalizes entity summarize/search responses
   */
  patchEntity(toolName, data) {
    let rawEntities = [];
    if (data && typeof data === "object") {
      if (Array.isArray(data.entities)) {
        rawEntities = data.entities;
      } else {
        rawEntities = [data];
      }
    } else if (Array.isArray(data)) {
      rawEntities = data;
    }

    const entities = rawEntities.slice(0, 10).map((e) => {
      if (!e || typeof e !== "object") return e;
      const alerts = e.alerts || [];
      return {
        entityId: e.entityId || e.id || e.name,
        entityType: e.entityType || e.type,
        primaryName: e.displayName || e.primaryName || e.name,
        riskScore: e.riskScore || e.score,
        firstSeen: e.firstSeenTime || e.firstSeen,
        lastSeen: e.lastSeenTime || e.lastSeen,
        summary: e.summary || e.description,
        associatedIps: (e.associatedIps || []).slice(0, 5),
        associatedUsers: (e.associatedUsers || []).slice(0, 5),
        recentAlertCount: e.recentAlertCount || alerts.length
      };
    });

    if (toolName === "summarize_entity" && entities.length === 1) {
      return entities[0];
    }

    return {
      totalEntities: rawEntities.length,
      entities
    };
  },

  /**
   * Evaluates and normalizes synthetic event generation responses
   */
  patchGenerateSyntheticEvents(data) {
    const events = data.events || data.syntheticEvents || (Array.isArray(data) ? data : []);
    const eventTypes = [
      ...new Set(
        events
          .map((e) => (e && typeof e === "object" ? e.metadata?.eventType : null))
          .filter(Boolean)
      )
    ];

    return {
      status: "SUCCESS",
      totalGenerated: events.length,
      eventTypes,
      sampleEvents: events.slice(0, 2).map((e) => this.pruneDeepObject(e, 3))
    };
  },

  /**
   * Evaluates and normalizes search_documents response
   */
  patchSearchDocuments(data) {
    const rawResults = data.results || (Array.isArray(data) ? data : []);
    const results = rawResults.slice(0, 8).map((item) => {
      if (!item || typeof item !== "object") return item;
      let content = item.content || "";
      if (content.length > 2000) {
        content = content.slice(0, 2000) + "... [truncated]";
      }
      return {
        id: item.id,
        parent: item.parent,
        content: content
      };
    });
    return { results };
  },

  /**
   * Evaluates and normalizes get_documents response
   */
  patchGetDocuments(data) {
    const rawDocs = data.documents || (Array.isArray(data) ? data : []);
    const documents = rawDocs.slice(0, 5).map((doc) => {
      if (!doc || typeof doc !== "object") return doc;
      let content = doc.content || "";
      if (content.length > 8000) {
        content = content.slice(0, 8000) + "\n... [truncated for brevity]";
      }
      return {
        title: doc.title,
        uri: doc.uri,
        description: doc.description,
        content: content
      };
    });
    return { documents };
  },

  /**
   * Master evaluator and patcher for SecOps MCP tools
   */
  patchToolResponse(toolName, rawResult) {
    if (!rawResult || typeof rawResult !== "object") {
      return rawResult;
    }
    // Explicit error visibility: never overwrite error payloads
    if (rawResult.error) {
      return rawResult;
    }

    try {
      switch (toolName) {
        case "search_documents":
          return this.patchSearchDocuments(rawResult);
        case "get_documents":
          return this.patchGetDocuments(rawResult);
        case "list_feeds":
          return this.patchListFeeds(rawResult);
        case "get_feed":
        case "create_feed":
        case "update_feed":
        case "enable_feed":
        case "disable_feed":
          return this.patchFeedOperation(toolName, rawResult);
        case "udm_search":
          return this.patchUdmSearch(rawResult);
        case "search_raw_logs":
          return this.patchSearchRawLogs(rawResult);
        case "list_security_alerts":
        case "get_security_alert":
        case "update_security_alert":
          return this.patchSecurityAlerts(toolName, rawResult);
        case "list_rule_detections":
          return this.patchListRuleDetections(rawResult);
        case "get_investigation_by_id":
        case "get_alert_latest_investigation":
        case "trigger_investigation":
          return this.patchInvestigation(toolName, rawResult);
        case "run_parser":
          return this.patchRunParser(rawResult);
        case "summarize_entity":
        case "search_entity":
          return this.patchEntity(toolName, rawResult);
        case "generate_synthetic_events":
          return this.patchGenerateSyntheticEvents(rawResult);
        case "list_log_entries":
          return this.patchListLogEntries(rawResult);
        case "list_log_names":
        case "list_buckets":
        case "list_views":
          return this.pruneDeepObject(rawResult, 3);
        default:
          return this.pruneDeepObject(rawResult, 4);
      }
    } catch (patchErr) {
      console.warn(`[MCP] Failed to run specialized patch for ${toolName}, falling back to deep pruner:`, patchErr);
      return this.pruneDeepObject(rawResult, 4);
    }
  },

  /**
   * Evaluates and normalizes list_log_entries response from Cloud Logging
   */
  patchListLogEntries(data) {
    const rawEntries = data.entries || (Array.isArray(data) ? data : []);
    const entries = rawEntries.slice(0, 25).map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const item = {
        timestamp: entry.timestamp,
        severity: entry.severity || "DEFAULT",
        logName: entry.logName ? entry.logName.split("/").pop() : undefined,
        insertId: entry.insertId,
        resource: entry.resource ? { type: entry.resource.type, labels: entry.resource.labels } : undefined
      };

      if (entry.textPayload) {
        item.textPayload = entry.textPayload.slice(0, 500);
      } else if (entry.jsonPayload) {
        item.jsonPayload = this.pruneDeepObject(entry.jsonPayload, 2);
      } else if (entry.protoPayload) {
        item.auditLog = {
          serviceName: entry.protoPayload.serviceName,
          methodName: entry.protoPayload.methodName,
          resourceName: entry.protoPayload.resourceName,
          callerIp: entry.protoPayload.requestMetadata?.callerIp,
          principalEmail: entry.protoPayload.authenticationInfo?.principalEmail,
          status: entry.protoPayload.status
        };
      }
      return item;
    });

    return {
      totalEntriesReturned: entries.length,
      nextPageToken: data.nextPageToken || undefined,
      entries
    };
  },

  /**
   * Helper to normalize any documentation path or URL into a canonical https://docs.cloud.google.com/... URL
   */
  normalizeDocUrl(raw) {
    if (!raw || typeof raw !== "string") return null;
    let clean = raw.trim().replace(/^documents\//, "");

    // Check if it's already an http(s) URL
    if (clean.startsWith("http://") || clean.startsWith("https://")) {
      return clean;
    }

    // Handle docs.cloud.google.com or cloud.google.com prefixes
    if (clean.startsWith("docs.cloud.google.com/") || clean.startsWith("cloud.google.com/")) {
      return `https://${clean}`;
    }

    // Handle chronicle/docs/... or security-operations/... patterns
    if (clean.startsWith("chronicle/docs/") || clean.startsWith("security-operations/") || clean.startsWith("logging/docs/")) {
      return `https://docs.cloud.google.com/${clean}`;
    }

    // Handle bare chronicle/... paths
    if (clean.startsWith("chronicle/")) {
      return `https://docs.cloud.google.com/${clean}`;
    }

    // Handle relative docs/ path
    if (clean.startsWith("docs/")) {
      return `https://docs.cloud.google.com/chronicle/${clean}`;
    }

    return null;
  },

  /**
   * Helper to format a friendly documentation title from a path or URL
   */
  formatDocTitle(pathOrUrl) {
    if (!pathOrUrl || typeof pathOrUrl !== "string") return "Google SecOps Documentation";
    const segments = pathOrUrl.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "Documentation";
    return slug
      .replace(/[#?].*$/, "")
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  },

  /**
   * Extract authoritative document source links from MCP tool output and arguments
   */
  extractDocSources(toolName, result, toolArgs) {
    const sources = [];
    const addSource = (rawUrl, explicitTitle) => {
      const canonicalUrl = this.normalizeDocUrl(rawUrl);
      if (!canonicalUrl) return;
      const title = explicitTitle || this.formatDocTitle(canonicalUrl);
      if (!sources.some((s) => s.url === canonicalUrl)) {
        sources.push({ title, url: canonicalUrl });
      }
    };

    // 1. Extract from tool arguments (e.g. get_documents names or query)
    if (toolArgs) {
      if (toolArgs.names && Array.isArray(toolArgs.names)) {
        for (const name of toolArgs.names) addSource(name);
      }
      if (toolArgs.name) addSource(toolArgs.name);
      if (typeof toolArgs.query === "string" && (toolArgs.query.includes("chronicle/docs") || toolArgs.query.includes("docs.cloud.google.com"))) {
        addSource(toolArgs.query);
      }
    }

    if (!result) return sources;

    // 2. Extract from search_documents results
    if (toolName === "search_documents") {
      const items = result.results || (Array.isArray(result) ? result : []);
      for (const item of items) {
        if (item.parent) addSource(item.parent);
        if (item.uri) addSource(item.uri, item.title);
        if (item.id && (item.id.includes("chronicle/docs") || item.id.includes("docs.cloud.google.com"))) {
          addSource(item.id);
        }
      }
    } else if (toolName === "get_documents") {
      const docs = result.documents || (Array.isArray(result) ? result : []);
      for (const doc of docs) {
        const title = doc.title || (doc.name ? this.formatDocTitle(doc.name) : null);
        if (doc.uri) addSource(doc.uri, title);
        if (doc.name) addSource(doc.name, title);
      }
    }

    // 3. Deep scan for embedded chronicle/docs or docs.cloud.google.com paths in result
    try {
      const str = JSON.stringify(result);
      const urlRegex = /(?:https?:\/\/)?(?:docs\.cloud\.google\.com|cloud\.google\.com)\/[a-zA-Z0-9_\-\.\/]+|chronicle\/docs\/[a-zA-Z0-9_\-\.\/]+/g;
      let match;
      while ((match = urlRegex.exec(str)) !== null) {
        const found = match[0];
        if (found.includes("chronicle/docs") || found.includes("security-operations") || found.includes("logging/docs")) {
          addSource(found);
        }
      }
    } catch (_) {}

    return sources;
  }
};
