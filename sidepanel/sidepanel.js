function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Render official doc sources at the bottom of messages (collapsed by default)
function renderSources(sources, isOpen = false) {
  if (!sources || sources.length === 0) return "";
  const count = sources.length;
  const items = sources
    .map(
      (s) =>
        `<li><a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.title}</a></li>`
    )
    .join("");
  return `
    <details class="sources-consulted-box"${isOpen ? " open" : ""}>
      <summary class="sources-header">
        <svg class="sources-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span class="sources-title">Documentation References (${count})</span>
        <svg class="sources-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </summary>
      <ul class="sources-list">${items}</ul>
    </details>
  `;
}

// SOC Co-Pilot: Humanized Action & Impact Card Helpers
function formatHumanizedAction(fnName) {
  const map = {
    create_case_comment: { title: "Add Case Comment", verb: "Comment on Case", severity: "low" },
    update_case: { title: "Modify Case Details", verb: "Update Case", severity: "medium" },
    update_security_alert: { title: "Update Security Alert", verb: "Modify Alert", severity: "medium" },
    execute_manual_action: { title: "Trigger SOAR Remediation", verb: "Execute Manual Action", severity: "high" },
    execute_bulk_close_case: { title: "Bulk Close Cases", verb: "Close Cases in Bulk", severity: "high" },
    create_rule: { title: "Deploy Detection Rule", verb: "Create Rule", severity: "medium" },
    validate_rule: { title: "Validate YARA-L Rule", verb: "Validate Rule", severity: "low" },
    add_rows_to_data_table: { title: "Insert Data Table Rows", verb: "Modify Data Table", severity: "medium" },
    delete_data_table_row: { title: "Delete Data Table Row", verb: "Remove Row", severity: "high" },
    enable_feed: { title: "Enable Ingestion Feed", verb: "Activate Feed", severity: "medium" },
    disable_feed: { title: "Disable Ingestion Feed", verb: "Deactivate Feed", severity: "high" },
    delete_feed: { title: "Delete Ingestion Feed", verb: "Remove Feed", severity: "high" },
    trigger_investigation: { title: "Trigger Autonomous Investigation", verb: "Launch Investigation", severity: "medium" }
  };
  if (map[fnName]) return map[fnName];
  const words = fnName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return { title: words, verb: words, severity: "medium" };
}

function extractImpactSummary(fnName, args) {
  if (!args || typeof args !== "object") return [];
  const rows = [];
  if (args.id || args.case_id || args.caseId) {
    const idVal = args.id || args.case_id || args.caseId;
    rows.push({ label: "Target Case / ID", value: `#${idVal}` });
  }
  if (args.alert_id || args.alertId) {
    rows.push({ label: "Target Alert", value: `${args.alert_id || args.alertId}` });
  }
  if (args.comment || args.text || args.commentText) {
    const txt = args.comment || args.text || args.commentText;
    const preview = txt.length > 95 ? txt.slice(0, 95) + "…" : txt;
    rows.push({ label: "Comment Text", value: `“${preview}”` });
  }
  if (args.status) {
    rows.push({ label: "New Status", value: `${args.status}` });
  }
  if (args.priority) {
    rows.push({ label: "New Priority", value: `${args.priority}` });
  }
  if (args.action_name || args.actionName || args.action_id || args.actionId) {
    rows.push({ label: "Action Intent", value: `${args.action_name || args.actionName || args.action_id || args.actionId}` });
  }
  if (args.rule_id || args.ruleName || args.rule_name) {
    rows.push({ label: "Target Rule", value: `${args.rule_id || args.ruleName || args.rule_name}` });
  }
  if (args.table_name || args.tableName) {
    rows.push({ label: "Target Data Table", value: `${args.table_name || args.tableName}` });
  }
  if (args.customer_id || args.customerId) {
    const cid = args.customer_id || args.customerId;
    rows.push({ label: "Customer Tenant", value: `${cid.slice(0, 8)}…` });
  }
  return rows;
}
/**
 * Google SecOps Side Panel Controller
 */

let activeTab = null;
let currentContext = null;
let conversationHistory = [];
let isStreaming = false;

// DOM Elements
const pagePillText = document.getElementById("pagePillText");
const errorBadge = document.getElementById("errorBadge");
const headerMenuBtn = document.getElementById("headerMenuBtn");
const headerMenuDropdown = document.getElementById("headerMenuDropdown");
const unslopToggle = document.getElementById("unslopToggle");
const includeContextToggle = document.getElementById("includeContextToggle");
const inspectContextBtn = document.getElementById("inspectContextBtn");
const contextInspector = document.getElementById("contextInspector");
const contextRawText = document.getElementById("contextRawText");
const refreshContextBtn = document.getElementById("refreshContextBtn");
const messagesContainer = document.getElementById("messagesContainer");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const clearChatBtn = document.getElementById("clearChatBtn");
const settingsBtn = document.getElementById("settingsBtn");
const skillsBtn = document.getElementById("skillsBtn");
const ambientSkillsPill = document.getElementById("ambientSkillsPill");
const ambientSkillsText = document.getElementById("ambientSkillsText");
const activeSkillChipContainer = document.getElementById("activeSkillChipContainer");
const activeSkillChipName = document.getElementById("activeSkillChipName");
const removeActiveSkillBtn = document.getElementById("removeActiveSkillBtn");
const slashCommandMenu = document.getElementById("slashCommandMenu");
const slashMenuList = document.getElementById("slashMenuList");
const skillsModal = document.getElementById("skillsModal");
const closeSkillsBtn = document.getElementById("closeSkillsBtn");
const showAddSkillBtn = document.getElementById("showAddSkillBtn");
const addSkillPanel = document.getElementById("addSkillPanel");
const skillUrlInput = document.getElementById("skillUrlInput");
const fetchSkillBtn = document.getElementById("fetchSkillBtn");
const customSkillName = document.getElementById("customSkillName");
const customSkillDesc = document.getElementById("customSkillDesc");
const customSkillContent = document.getElementById("customSkillContent");
const saveCustomSkillBtn = document.getElementById("saveCustomSkillBtn");
const addSkillStatus = document.getElementById("addSkillStatus");
const skillsListContainer = document.getElementById("skillsListContainer");
const quickActions = document.getElementById("quickActions");
const captureScreenBtn = document.getElementById("captureScreenBtn");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imageThumbnail = document.getElementById("imageThumbnail");
const removeImageBtn = document.getElementById("removeImageBtn");
const suggestionsFilterBar = document.getElementById("suggestionsFilterBar");
const filterTabAll = document.getElementById("filterTabAll");
const filterTabHelp = document.getElementById("filterTabHelp");
const filterTabAction = document.getElementById("filterTabAction");
const aiPointerToggle = document.getElementById("aiPointerToggle");

let currentSuggestionFilter = "all"; // "all" | "help" | "action"
let currentAbortController = null;
let attachedImage = null;
let activeOnDemandSkill = null;
let currentSlashMatches = [];
let selectedSlashIndex = 0;

// Settings Modal Elements
const settingsModal = document.getElementById("settingsModal");
const closeSettingsBtn = document.getElementById("closeSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const apiKeyGroup = document.getElementById("apiKeyGroup");
const vertexGroup = document.getElementById("vertexGroup");
const apiKeyInput = document.getElementById("apiKeyInput");
const gcpProjectInput = document.getElementById("gcpProjectInput");
const gcpRegionInput = document.getElementById("gcpRegionInput");
const oauthClientIdInput = document.getElementById("oauthClientIdInput");
const mcpGroundingCheckbox = document.getElementById("mcpGroundingCheckbox");
const secopsMcpCheckbox = document.getElementById("secopsMcpCheckbox");
const secopsCustomerIdInput = document.getElementById("secopsCustomerIdInput");
const secopsRegionInput = document.getElementById("secopsRegionInput");
const modelSelect = document.getElementById("modelSelect");
const settingsStatus = document.getElementById("settingsStatus");

// Full GitHub Flavored Markdown formatter using marked with fallbacks
function formatMarkdown(text) {
  if (!text) return "";

  // Auto-link bare documentation paths: chronicle/docs/... or docs.cloud.google.com/chronicle/...
  let processedText = text.replace(
    /(^|[\s(])((?:docs\.cloud\.google\.com\/|cloud\.google\.com\/)?chronicle\/docs\/[a-zA-Z0-9_\-\.\/]+)/g,
    (match, prefix, path) => {
      const cleanPath = path.replace(/^https?:\/\//, "").replace(/^documents\//, "");
      const fullUrl = cleanPath.startsWith("docs.cloud.google.com/") ? `https://${cleanPath}` : `https://docs.cloud.google.com/${cleanPath}`;
      const slug = cleanPath.split("/").filter(Boolean).pop() || "documentation";
      const title = slug.replace(/[#?].*$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return `${prefix}[${title} ↗](${fullUrl})`;
    }
  );

  if (typeof marked !== "undefined" && marked.parse) {
    try {
      const parsed = marked.parse(processedText, {
        breaks: true,
        gfm: true
      });
      let html = parsed.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (match, attrs, code) => {
        return `<pre><button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText)">Copy</button><code${attrs}>${code}</code></pre>`;
      });
      // Ensure all anchor tags open safely in a new tab
      html = html.replace(/<a\s+([^>]*href=[^>]*)>/gi, (match, rest) => {
        if (!rest.includes("target=")) {
          return `<a target="_blank" rel="noopener noreferrer" ${rest}>`;
        }
        return match;
      });
      return html;
    } catch (e) {
      console.warn("marked.parse error:", e);
    }
  }

  // Fallback regex parser
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><button class="copy-code-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText)">Copy</button><code>${code.trim()}</code></pre>`;
  });

  escaped = escaped.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  escaped = escaped.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  escaped = escaped.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  escaped = escaped.replace(/^---$/gim, "<hr>");
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  escaped = escaped.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");

  return `<p>${escaped}</p>`;
}

/**
 * 1. Synchronize with Active Tab and Trigger Context Extraction
 */
async function syncActiveTab(providedTab = null) {
  if (providedTab && providedTab.url) {
    activeTab = providedTab;
    await extractContextFromTab(activeTab);
    return;
  }

  // Query last-focused window first, fallback to currentWindow
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      await extractContextFromTab(activeTab);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, async (fallbackTabs) => {
        if (fallbackTabs && fallbackTabs.length > 0) {
          activeTab = fallbackTabs[0];
          await extractContextFromTab(activeTab);
        }
      });
    }
  });
}

async function extractContextFromTab(tab) {
  if (!tab || !tab.id) return;

  const url = tab.url || "";
  const isTarget =
    url.includes("chronicle.security") ||
    url.includes("secops.google.com") ||
    url.includes("cloud.google.com/chronicle") ||
    url.includes("docs.cloud.google.com");

  if (!isTarget) {
    pagePillText.textContent = "Outside SecOps";
    pagePillText.parentElement.style.opacity = "0.7";
    errorBadge.classList.add("hidden");
    currentContext = null;
    contextRawText.textContent = "Active tab is not a Google SecOps or Documentation page.";
    return;
  }

  pagePillText.parentElement.style.opacity = "1";

  // 1. Immediately apply URL-derived route context so UI updates with zero latency
  deriveContextFromUrl(tab);

  // 2. Query content script for live DOM extractions
  try {
    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_CONTEXT" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        // Content script not yet injected into this tab instance (e.g. tab was loaded before extension reload)
        // Automatically inject content scripts via scripting API
        if (chrome.scripting && chrome.scripting.executeScript && tab.id) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [
              "content/dom_utils.js",
              "content/extractors/workdesk.js",
              "content/extractors/soar_search.js",
              "content/extractors/data_tables.js",
              "content/extractors/threats.js",
              "content/extractors/udm_search.js",
              "content/extractors/rules_editor.js",
              "content/extractors/case_view.js",
              "content/extractors/breach_analytics.js",
              "content/extractors/docs_view.js",
              "content/extractors/settings_view.js",
              "content/content_script.js",
              "content/ai_pointer.js"
            ]
          }).then(() => {
            // Retry extraction after dynamic injection
            chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_CONTEXT" }, (retryRes) => {
              if (!chrome.runtime.lastError && retryRes && retryRes.success) {
                currentContext = retryRes.data;
                updateContextUI(currentContext);
              }
            });
          }).catch((err) => {
            console.debug("Auto-inject script debug:", err.message);
          });
        }
        return;
      }

      currentContext = response.data;
      updateContextUI(currentContext);
    });
  } catch (err) {
    console.debug("Extraction message error:", err);
  }
}

function deriveContextFromUrl(tab) {
  const url = tab.url || "";
  let feature = "Google SecOps";
  let featureContext = { feature: feature };

  // 1. Check Settings routes (e.g. /settings/feeds, /settings/email-domains, /settings/data-tables)
  const settingsMatch = url.match(/(?:\/settings|\/admin|\/configuration)\/([a-zA-Z0-9_\-]+)/i);
  if (settingsMatch && settingsMatch[1]) {
    const slug = settingsMatch[1].toLowerCase();
    const settingMap = {
      "email-domains": {
        title: "Email Domains",
        purpose: "Defines internal corporate vs. external domains for sender classification, entity identity resolution, and phishing detection playbooks."
      },
      "data-tables": {
        title: "Data Tables",
        purpose: "Tabular reference datasets queried during detection rule evaluation and automated playbook enrichment."
      },
      "feeds": {
        title: "Feeds & Ingestion",
        purpose: "Configures raw log ingestion sources, collectors, API feeds, and cloud storage forwarders."
      },
      "parsers": {
        title: "Parsers & Extensions",
        purpose: "Manages Logstash / CBN parsing code transforming raw security events into the unified data model (UDM)."
      },
      "reference-lists": {
        title: "Reference Lists",
        purpose: "Custom indicator lists (IPs, domains, regexes, CIDRs) matched by YARA-L detection rules."
      },
      "user-management": {
        title: "User Management",
        purpose: "Defines analyst accounts, RBAC roles, and access permissions in SecOps."
      },
      "integrations": {
        title: "Integrations",
        purpose: "Third-party connector configurations for SOAR playbooks and actions."
      }
    };

    const info = settingMap[slug] || {
      title: slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      purpose: "Google SecOps console administrative setting."
    };

    feature = `Settings • ${info.title}`;
    featureContext = {
      feature: feature,
      settingSlug: slug,
      settingTitle: info.title,
      settingPurpose: info.purpose
    };
  } else if (url.includes("/your-workdesk")) {
    // 2. Workdesk routes (/your-workdesk/cases, /your-workdesk/pending-actions, /tasks, /requests, /workspace, /announcements)
    const workdeskMatch = url.match(/\/your-workdesk\/([a-zA-Z0-9_\-]+)/i);
    let subTab = "cases";
    if (workdeskMatch && workdeskMatch[1]) {
      subTab = workdeskMatch[1].toLowerCase();
    }
    const tabMap = {
      cases: "Cases",
      "pending-actions": "Pending Actions",
      tasks: "Tasks",
      requests: "Requests",
      workspace: "Workspace",
      announcements: "Announcements"
    };
    const tabDisplay = tabMap[subTab] || (subTab.charAt(0).toUpperCase() + subTab.slice(1).replace(/[-_]+/g, " "));
    feature = `Workdesk • ${tabDisplay}`;
    featureContext = {
      feature: feature,
      route: "workdesk",
      subTab: subTab,
      subTabTitle: tabDisplay
    };
  } else if (url.includes("/sp-search")) {
    // 3. SOAR Search (/sp-search) - Must precede /search check!
    feature = "SOAR Search";
    featureContext = {
      feature: feature,
      route: "soar-search"
    };
  } else if (url.includes("/data-tables")) {
    // 4. Data Tables (/data-tables)
    feature = "Data Tables";
    featureContext = {
      feature: feature,
      route: "data-tables"
    };
  } else if (url.includes("/threats")) {
    // 5. Threats (/threats)
    feature = "Applied Threat Intelligence";
    featureContext = {
      feature: feature,
      route: "threats"
    };
  } else if (url.toLowerCase().includes("/rulesets") || url.includes("/chronicleAnalytics/ruleSets")) {
    // 6. Curated Rules (/chronicleAnalytics/ruleSets) - Must precede /rules check!
    feature = "Curated Rules";
    featureContext = {
      feature: feature,
      route: "curated-rules"
    };
  } else if (url.includes("/rules") || url.includes("/detection/rules") || url.includes("/rule-editor")) {
    // 7. YARA-L Rules (/rules or /rule-editor)
    const isEditor = url.includes("/rule-editor") || url.includes("/rules/editor") || url.includes("edit=true");
    feature = isEditor ? "YARA-L Rules Editor" : "YARA-L Rules";
    featureContext = {
      feature: feature,
      route: isEditor ? "rules-editor" : "rules"
    };
  } else if (url.includes("/cases") || url.includes("/alerts") || url.includes("/investigation")) {
    // 8. Check Case & Alert routes (e.g. /cases/106565/wall, /cases/106565/alerts)
    const caseMatch = url.match(/\/cases\/([a-zA-Z0-9_\-]+)(?:\/([a-zA-Z0-9_\-]+))?/i);
    let caseId = null;
    let subTab = "overview";
    if (caseMatch) {
      caseId = caseMatch[1];
      if (caseMatch[2]) subTab = caseMatch[2].toLowerCase();
    }
    const tabMap = {
      wall: "Wall (Activity & Comments)",
      alerts: "Alerts",
      overview: "Overview",
      playbook: "Playbooks",
      playbooks: "Playbooks",
      evidence: "Evidence & IOCs",
      entities: "Involved Entities",
      timeline: "Investigation Timeline"
    };
    const tabDisplay = tabMap[subTab] || (subTab.charAt(0).toUpperCase() + subTab.slice(1));
    feature = caseId ? `Case #${caseId} • ${tabDisplay}` : "Alert & Case Investigation";
    featureContext = {
      feature: feature,
      caseId: caseId,
      subTab: subTab
    };
  } else if (url.includes("/search")) {
    feature = "UDM Search";
    featureContext = { feature: feature };
  } else if (url.includes("/breach-analytics")) {
    let startTime = null;
    let endTime = null;
    let displayTime = null;
    try {
      const urlObj = new URL(url);
      startTime = urlObj.searchParams.get("startTime");
      endTime = urlObj.searchParams.get("endTime");
      if (startTime && endTime) {
        const startShort = startTime.split("T")[0] || startTime;
        const endShort = endTime.split("T")[0] || endTime;
        displayTime = `${startShort} - ${endShort}`;
      }
    } catch (_) {}

    feature = displayTime ? `Breach Analytics • ${displayTime}` : "Breach Analytics";
    featureContext = {
      feature: feature,
      route: "breach-analytics",
      startTime: startTime,
      endTime: endTime,
      timeWindow: startTime && endTime ? `${startTime} to ${endTime}` : null
    };
  } else if (
    url.includes("docs.cloud.google.com") ||
    url.includes("cloud.google.com/chronicle") ||
    url.includes("cloud.google.com/security-operations") ||
    url.includes("chronicle/docs")
  ) {
    feature = "Google SecOps Documentation";
    featureContext = { feature: feature };
  }

  currentContext = {
    url: url,
    title: tab.title || "SecOps",
    featureContext: featureContext
  };
  updateContextUI(currentContext);
}

function updateContextUI(ctx) {
  if (!ctx) return;

  const feature = ctx.featureContext?.feature || "Google SecOps";
  pagePillText.textContent = feature;

  const errors = ctx.featureContext?.detectedErrors || [];
  if (errors.length > 0) {
    errorBadge.textContent = `${errors.length} Error${errors.length > 1 ? "s" : ""}`;
    errorBadge.classList.remove("hidden");
  } else {
    errorBadge.classList.add("hidden");
  }

  // Update Raw Preview
  const formatted = window.SecOpsPrompts.buildContextString(ctx);
  contextRawText.textContent = formatted || "No specific context extracted.";

  // Dynamically update quick-action chips based on active page depth
  renderQuickActionChips(ctx);
}

/**
 * 2. Background Event Listeners for Tab Changes & SPA Route Changes
 */
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_NAVIGATED" || message.type === "TAB_SWITCHED" || message.type === "PAGE_LOAD_COMPLETE") {
    if (message.url) {
      syncActiveTab({ id: message.tabId, url: message.url, title: message.title });
    } else {
      syncActiveTab();
    }
  } else if (message.type === "AI_POINTER_TRIGGERED") {
    handleAiPointerTrigger(message);
  }
});

/**
 * AI Pointer Action Controller (DeepMind Magic Pointer concept)
 */
function handleAiPointerTrigger(message) {
  const { action, elementInfo, bounds, screenshotUrl } = message;

  if (screenshotUrl && bounds && bounds.width > 0 && bounds.height > 0) {
    cropAndAttachScreenshot(screenshotUrl, bounds, () => {
      executeAiPointerAction(action, elementInfo);
    });
  } else {
    executeAiPointerAction(action, elementInfo);
  }
}

function cropAndAttachScreenshot(dataUrl, bounds, callback) {
  const img = new Image();
  img.onload = () => {
    try {
      const dpr = bounds.dpr || window.devicePixelRatio || 1;
      const sx = bounds.left !== undefined ? bounds.left : (bounds.x || 0);
      const sy = bounds.top !== undefined ? bounds.top : (bounds.y || 0);
      const cropX = Math.max(0, sx * dpr);
      const cropY = Math.max(0, sy * dpr);
      const cropW = Math.min(img.width - cropX, bounds.width * dpr);
      const cropH = Math.min(img.height - cropY, bounds.height * dpr);

      if (cropW > 8 && cropH > 8) {
        const canvas = document.createElement("canvas");
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        const croppedDataUrl = canvas.toDataURL("image/png");
        const base64Data = croppedDataUrl.replace(/^data:image\/png;base64,/, "");

        attachedImage = {
          mimeType: "image/png",
          data: base64Data,
          previewUrl: croppedDataUrl
        };
        if (imageThumbnail) imageThumbnail.src = croppedDataUrl;
        if (imagePreviewContainer) imagePreviewContainer.style.display = "flex";
      } else {
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        attachedImage = {
          mimeType: "image/png",
          data: base64Data,
          previewUrl: dataUrl
        };
        if (imageThumbnail) imageThumbnail.src = dataUrl;
        if (imagePreviewContainer) imagePreviewContainer.style.display = "flex";
      }
    } catch (e) {
      console.warn("Error cropping AI Pointer screenshot:", e);
    }
    if (callback) callback();
  };
  img.onerror = () => {
    if (callback) callback();
  };
  img.src = dataUrl;
}

function executeAiPointerAction(action, elementInfo) {
  const elementText = elementInfo?.text || "selected element";
  const elementTag = elementInfo?.tag || "element";
  const feature = currentContext?.featureContext?.feature || "Google SecOps";

  if (action === "docs") {
    currentSuggestionFilter = "help";
    if (suggestionsFilterBar) {
      suggestionsFilterBar.querySelectorAll(".filter-tab").forEach((t) => {
        const isActive = t.getAttribute("data-filter") === "help";
        t.classList.toggle("active", isActive);
        t.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }
    const prompt = `Search Google SecOps documentation to explain the following UI element and workflow: "${elementText}" (Element: <${elementTag}> on ${feature})`;
    handleSendMessage(prompt, { targetMcp: "help" });
  } else if (action === "mcp") {
    currentSuggestionFilter = "action";
    if (suggestionsFilterBar) {
      suggestionsFilterBar.querySelectorAll(".filter-tab").forEach((t) => {
        const isActive = t.getAttribute("data-filter") === "action";
        t.classList.toggle("active", isActive);
        t.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }
    const prompt = `Investigate "${elementText}" using SecOps MCP tools (Context: ${feature}).`;
    handleSendMessage(prompt, { targetMcp: "action" });
  } else if (action === "capture") {
    chatInput.value = `Analyze this <${elementTag}> widget ("${elementText}") on ${feature} and explain its significance:`;
    chatInput.focus();
  }
}


/**
 * 3. Chat Interaction & Streaming
 */
async function handleSendMessage(customPrompt = null, options = {}) {
  if (isStreaming) {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    return;
  }

  const text = (customPrompt || chatInput.value).trim();
  if (!text && !attachedImage) return;

  let skillToSend = activeOnDemandSkill;
  let promptText = text || (attachedImage ? "Analyze what is visible on this SecOps screen and provide troubleshooting / guidance." : "");

  // Detect direct slash command typing (e.g. /secops-cases 106616)
  if (promptText.startsWith("/")) {
    const match = promptText.match(/^(\/[a-z0-9\-_]+)(?:\s+([\s\S]*))?$/i);
    if (match && window.SecOpsSkillManager) {
      const cmd = match[1];
      const found = await window.SecOpsSkillManager.findSkillByCommand(cmd);
      if (found) {
        skillToSend = found;
        promptText = (match[2] || "").trim() || `Activate and execute the ${found.name} protocol.`;
      }
    }
  }

  chatInput.value = "";
  chatInput.style.height = "auto";
  hideSlashMenu();

  // Capture attached image reference and reset UI preview
  const imageToSend = attachedImage;
  attachedImage = null;
  if (imagePreviewContainer) imagePreviewContainer.style.display = "none";

  // Append user message to UI
  appendMessage("user", promptText, imageToSend, skillToSend);

  // Determine context payload
  const contextToSend = includeContextToggle.checked ? currentContext : null;

  // Append assistant message container with loading state
  const assistantBubble = appendMessage("assistant", "Thinking...");
  const contentEl = assistantBubble.querySelector(".message-content");

  // Setup AbortController and morph Send button to Stop
  currentAbortController = new AbortController();
  isStreaming = true;
  sendBtn.classList.add("streaming");
  const sendIcon = sendBtn.querySelector(".send-icon");
  const stopIcon = sendBtn.querySelector(".stop-icon");
  if (sendIcon) sendIcon.style.display = "none";
  if (stopIcon) stopIcon.style.display = "inline";
  sendBtn.title = "Stop generating (Cancel)";

  let fullResponse = "";
  let activeToolPill = "";
  let consultedSources = [];
  let result = null;

  try {
    setActiveOnDemandSkill(null);

    // Target MCP mode: "help" (Docs), "action" (SecOps), or "all"
    const targetMcpMode = options.targetMcp || (currentSuggestionFilter !== "all" ? currentSuggestionFilter : "all");

    result = await window.SecOpsGeminiClient.streamChat({
      messages: conversationHistory,
      userPrompt: promptText,
      pageContext: contextToSend,
      image: imageToSend,
      invokedSkill: skillToSend,
      targetMcp: targetMcpMode,
      useUnslop: true,
      abortSignal: currentAbortController.signal,
      onToolActivity: ({ tool, query }) => {
        const isDocs = tool === "search_documents" || tool === "get_documents";
        const iconSvg = isDocs
          ? `<svg class="pill-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`
          : `<svg class="pill-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
        const label = isDocs ? "Google SecOps Docs" : `SecOps Remote MCP (${tool})`;

        let queryDisplay = query ? `<em>${escapeHtml(query)}</em>` : `<em>${escapeHtml(tool)}</em>`;
        if (isDocs && query && window.SecOpsMcpClient?.normalizeDocUrl) {
          const docUrl = window.SecOpsMcpClient.normalizeDocUrl(query);
          if (docUrl) {
            const title = window.SecOpsMcpClient.formatDocTitle(query);
            queryDisplay = `<a href="${docUrl}" target="_blank" rel="noopener noreferrer" class="mcp-doc-link">${escapeHtml(title)} ↗</a>`;
            if (!consultedSources.some((s) => s.url === docUrl)) {
              consultedSources.push({ title, url: docUrl });
            }
          }
        }

        activeToolPill = `<div class="mcp-status-pill mcp-running">${iconSvg} <span class="mcp-pill-label">${escapeHtml(label)}</span>: ${queryDisplay}</div>`;
        const isSourcesOpen = contentEl.querySelector(".sources-consulted-box")?.open || false;
        const sourcesHtml = renderSources(consultedSources, isSourcesOpen);
        contentEl.innerHTML = activeToolPill + formatMarkdown(fullResponse) + sourcesHtml;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      },
      onConfirmAction: async (fnName, fnArgs) => {
        return new Promise((resolve) => {
          const actionMeta = formatHumanizedAction(fnName);
          const impactRows = extractImpactSummary(fnName, fnArgs);

          const banner = document.createElement("div");
          banner.className = "action-confirm-banner soc-impact-card";
          banner.setAttribute("role", "alertdialog");
          banner.setAttribute("aria-labelledby", "impactCardTitle");

          const rowsHtml = impactRows.length > 0
            ? impactRows.map((r) => `
                <div class="impact-row">
                  <span class="impact-label">${escapeHtml(r.label)}</span>
                  <span class="impact-value">${escapeHtml(r.value)}</span>
                </div>
              `).join("")
            : `<div class="impact-row"><span class="impact-label">Action</span><span class="impact-value"><code>${escapeHtml(fnName)}</code></span></div>`;

          banner.innerHTML = `
            <div class="impact-header">
              <div class="impact-header-left">
                <svg class="impact-badge-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div class="impact-header-text">
                  <strong id="impactCardTitle">${escapeHtml(actionMeta.title)}</strong>
                  <span class="impact-header-sub">Action Authorization Required</span>
                </div>
              </div>
              <span class="impact-severity-tag severity-${actionMeta.severity}">MUTATING ACTION</span>
            </div>
            <div class="impact-body">
              <div class="impact-summary-grid">
                ${rowsHtml}
              </div>
              <details class="impact-raw-details">
                <summary>Inspect Wire Payload (JSON)</summary>
                <pre>${escapeHtml(JSON.stringify(fnArgs, null, 2))}</pre>
              </details>
            </div>
            <div class="confirm-actions">
              <button class="primary-btn confirm-approve-btn">
                <svg class="btn-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Authorize & Execute</span>
              </button>
              <button class="confirm-cancel-btn">
                <svg class="btn-svg-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                <span>Reject</span>
              </button>
            </div>
          `;
          contentEl.appendChild(banner);
          messagesContainer.scrollTop = messagesContainer.scrollHeight;

          banner.querySelector(".confirm-approve-btn").addEventListener("click", () => {
            banner.remove();
            resolve(true);
          });
          banner.querySelector(".confirm-cancel-btn").addEventListener("click", () => {
            banner.remove();
            resolve(false);
          });
        });
      },
      onSources: (sources) => {
        consultedSources = sources;
      },
      onChunk: (chunk, accumulated) => {
        fullResponse = accumulated;
        if (activeToolPill && activeToolPill.includes("mcp-running")) {
          activeToolPill = activeToolPill.replace("mcp-running", "mcp-completed");
        }
        const isSourcesOpen = contentEl.querySelector(".sources-consulted-box")?.open || false;
        const sourcesHtml = renderSources(consultedSources, isSourcesOpen);
        contentEl.innerHTML = (activeToolPill ? activeToolPill : "") + formatMarkdown(accumulated) + sourcesHtml;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    });

    if (activeToolPill && activeToolPill.includes("mcp-running")) {
      activeToolPill = activeToolPill.replace("mcp-running", "mcp-completed");
    }

    if (!fullResponse.trim() && result?.text?.trim()) {
      fullResponse = result.text.trim();
    }

    if (!fullResponse.trim()) {
      if (consultedSources.length > 0) {
        fullResponse = "Consulted the documentation sources below for your query.";
      } else if (result?.lastToolResult?.error) {
        fullResponse = `MCP operation (${result.lastTool || "tool"}) completed with note: ${result.lastToolResult.error}`;
      } else if (result?.lastTool) {
        fullResponse = `Completed ${result.lastTool} operation successfully.`;
      } else {
        fullResponse = "Operation completed, but no text was returned by the model.";
      }
    }

    const isSourcesOpen = contentEl.querySelector(".sources-consulted-box")?.open || false;
    const finalSourcesHtml = renderSources(consultedSources, isSourcesOpen);
    contentEl.innerHTML = (activeToolPill ? activeToolPill : "") + formatMarkdown(fullResponse) + finalSourcesHtml;
    attachMessageActions(assistantBubble, fullResponse);

    // Record to conversation history
    conversationHistory.push({ role: "user", text: promptText });
    conversationHistory.push({ role: "assistant", text: fullResponse });

  } catch (err) {
    if (activeToolPill && activeToolPill.includes("mcp-running")) {
      activeToolPill = activeToolPill.replace("mcp-running", "mcp-completed");
    }
    if (err.name === "AbortError" || currentAbortController?.signal?.aborted) {
      const isSourcesOpen = contentEl.querySelector(".sources-consulted-box")?.open || false;
      const sourcesHtml = renderSources(consultedSources, isSourcesOpen);
      contentEl.innerHTML = (activeToolPill ? activeToolPill : "") + formatMarkdown(fullResponse) + sourcesHtml + '<div class="generation-stopped-note">⏹ <em>Response stopped by user</em></div>';
      if (fullResponse) {
        conversationHistory.push({ role: "user", text: promptText });
        conversationHistory.push({ role: "assistant", text: fullResponse });
      }
    } else {
      contentEl.innerHTML = `<p style="color: var(--accent-red);"><strong>Error:</strong> ${err.message}</p>`;
    }
  } finally {
    isStreaming = false;
    sendBtn.classList.remove("streaming");
    const sendIcon = sendBtn.querySelector(".send-icon");
    const stopIcon = sendBtn.querySelector(".stop-icon");
    if (sendIcon) sendIcon.style.display = "inline";
    if (stopIcon) stopIcon.style.display = "none";
    sendBtn.title = "Send message";
    currentAbortController = null;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

function appendMessage(role, initialHtml, image = null, skill = null) {
  const msgEl = document.createElement("div");
  msgEl.className = `message ${role}`;

  const contentEl = document.createElement("div");
  contentEl.className = "message-content";

  let formattedHtml = formatMarkdown(initialHtml);
  if (role === "user" && skill) {
    const cmd = skill.command || `/${skill.id}`;
    formattedHtml = `<div class="user-skill-badge"><span class="user-skill-icon">🧩</span> <span class="user-skill-cmd">${escapeHtml(cmd)}</span></div>` + formattedHtml;
  }
  contentEl.innerHTML = formattedHtml;

  if (image && image.previewUrl) {
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "user-attached-thumb";
    const imgEl = document.createElement("img");
    imgEl.src = image.previewUrl;
    imgEl.alt = "Attached screenshot";
    imgWrapper.appendChild(imgEl);
    contentEl.appendChild(imgWrapper);
  }

  msgEl.appendChild(contentEl);
  messagesContainer.appendChild(msgEl);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  return msgEl;
}

/**
 * Attach quick action buttons (Copy, Insert into Page) to assistant messages
 */
function attachMessageActions(bubble, text) {
  if (!bubble || !text) return;
  const contentEl = bubble.querySelector(".message-content");
  if (!contentEl) return;

  const actionsContainer = document.createElement("div");
  actionsContainer.className = "message-actions";

  // 1. Copy Response
  const copyBtn = document.createElement("button");
  copyBtn.className = "message-action-btn";
  copyBtn.innerHTML = `<span>📋</span> <span>Copy</span>`;
  copyBtn.title = "Copy response to clipboard";
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.innerHTML = `<span>✓</span> <span>Copied!</span>`;
      copyBtn.classList.add("success");
      setTimeout(() => {
        copyBtn.innerHTML = `<span>📋</span> <span>Copy</span>`;
        copyBtn.classList.remove("success");
      }, 2000);
    } catch {
      // ignore clipboard error
    }
  });
  actionsContainer.appendChild(copyBtn);

  // 2. Insert into Page (e.g. Case Wall comments, notes, inputs)
  const insertBtn = document.createElement("button");
  insertBtn.className = "message-action-btn";
  insertBtn.innerHTML = `<span>📝</span> <span>Insert into Page</span>`;
  insertBtn.title = "Inject this text into the active comment box or text field on screen";
  insertBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) return;
      chrome.tabs.sendMessage(tabs[0].id, { type: "INJECT_TEXT_INTO_PAGE", text }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          const reason = res?.reason || chrome.runtime.lastError?.message || "Could not find a comment box or input on this page.";
          alert(reason);
        } else {
          insertBtn.innerHTML = `<span>✓</span> <span>Inserted!</span>`;
          insertBtn.classList.add("success");
          setTimeout(() => {
            insertBtn.innerHTML = `<span>📝</span> <span>Insert into Page</span>`;
            insertBtn.classList.remove("success");
          }, 2500);
        }
      });
    });
  });
  actionsContainer.appendChild(insertBtn);

  contentEl.appendChild(actionsContainer);
}


/**
 * Context-Aware Dynamic Suggestions (Help via Docs MCP vs Action via SecOps MCP)
 * Adapts chips dynamically based on the active page, sub-tab, and feature depth.
 */
function renderQuickActionChips(ctx) {
  if (!quickActions || !ctx || !ctx.featureContext) return;
  const fc = ctx.featureContext;

  let chips = [];

  if (fc.caseId || (fc.feature && fc.feature.includes("Case"))) {
    const caseId = fc.caseId || "Current Case";
    const subTab = (fc.subTab || "").toLowerCase();

    if (subTab === "wall") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Case wall & triage guide", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for SOAR case wall collaboration, comment etiquette, and timeline investigation practices." },
        { label: "📖 Playbook debug docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for playbook error codes, action timeout limits, and failure recovery." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Summarize wall activity", category: "action", targetMcp: "action", prompt: `Summarize the recent case wall activity and comments for Case #${caseId}. Highlight key analyst findings, playbook actions, and timeline events.` },
        { label: "⚡ Draft case closing notes", category: "action", targetMcp: "action", prompt: `Draft a formal root-cause analysis and closing summary for Case #${caseId} based on the wall events.` },
        { label: "⚡ Audit playbook execution", category: "action", targetMcp: "action", prompt: `Review the automated playbook actions on the wall for Case #${caseId} and identify any failed or incomplete steps.` },
        { label: "⚡ Recommend next steps", category: "action", targetMcp: "action", prompt: `Based on this case wall context, recommend the next prioritized investigation and containment steps for Case #${caseId}.` }
      ];
    } else if (subTab === "alerts") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Alert grouping & deduplication", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for alert grouping models, deduplication windows, and threshold tuning." },
        { label: "📖 ATT&CK technique mapping", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for how alerts are tagged and mapped to MITRE ATT&CK tactics and techniques." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Analyze attached alerts", category: "action", targetMcp: "action", prompt: `Analyze the alerts grouped into Case #${caseId} using SecOps MCP. Explain their detection logic and severity.` },
        { label: "⚡ Correlate detection rules", category: "action", targetMcp: "action", prompt: `Correlate the triggered detection rules in Case #${caseId} using SecOps MCP to identify potential attack progression or lateral movement.` },
        { label: "⚡ Prioritize investigation", category: "action", targetMcp: "action", prompt: `Which alert in Case #${caseId} poses the highest risk and should be investigated first?` }
      ];
    } else {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Case lifecycle documentation", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for SOAR case triage lifecycle, status transitions, and escalation workflows." },
        { label: "📖 Entity resolution docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for entity graph modeling, aliases, and enrichment lookup providers." },
        // Action suggestions (SecOps MCP)
        { label: `⚡ Analyze Case #${caseId}`, category: "action", targetMcp: "action", prompt: `Provide a comprehensive analysis of Case #${caseId} using SecOps MCP, including its title, severity, status, and involved entities.` },
        { label: "⚡ Investigate entities", category: "action", targetMcp: "action", prompt: `Analyze the involved entities in Case #${caseId} and query live UDM telemetry or entity summaries using SecOps MCP.` },
        { label: "⚡ Draft analyst notes", category: "action", targetMcp: "action", prompt: `Draft preliminary analyst investigation notes for Case #${caseId}.` }
      ];
    }
  } else if (fc.settingSlug || (fc.feature && fc.feature.startsWith("Settings •"))) {
    const slug = fc.settingSlug || "general";
    const title = fc.settingTitle || "Settings";

    if (slug === "email-domains") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📧 Email Domains doc guide", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for internal email domains configuration, entity resolution, and phishing detection rules." },
        { label: "📖 Phishing triage best practices", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for corporate vs partner email domain classification in phishing playbooks." },
        { label: "📖 Troubleshoot domain syntax", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for valid email domain patterns, regex requirements, and validation rules." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Audit configured domains", category: "action", targetMcp: "action", prompt: "Review the configured email domains on this screen. Point out any syntax issues, missing primary corporate domains, or regex pitfalls." },
        { label: "⚡ Test domain resolution", category: "action", targetMcp: "action", prompt: "Check recent telemetry for emails received from outside these configured email domains using SecOps MCP." }
      ];
    } else if (slug === "data-tables") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Data Tables syntax docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Data Tables syntax, column types, and how to reference them in YARA-L rules." },
        { label: "📖 Data table best practices", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for common security use cases for Data Tables (VIP lists, asset criticality, IOC feeds)." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ List active data tables", category: "action", targetMcp: "action", prompt: "Query all active data tables in this SecOps tenant using SecOps MCP and review their schema." },
        { label: "⚡ Audit table freshness", category: "action", targetMcp: "action", prompt: "Inspect row entries and freshness across configured threat intelligence data tables using SecOps MCP." }
      ];
    } else if (slug === "feeds") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Feed setup & auth docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for feed configuration guides, S3/PubSub authentication, and log type mapping." },
        { label: "📖 Troubleshoot feed ingestion", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for resolving feed ingestion errors, quota drops, and transport latency." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ List ingestion feeds", category: "action", targetMcp: "action", prompt: "Query all configured log ingestion feeds and their operational health status using SecOps MCP." },
        { label: "⚡ Audit failed feeds", category: "action", targetMcp: "action", prompt: "Audit configured feeds using SecOps MCP and report any feeds in ERROR or stalled status." }
      ];
    } else if (slug === "parsers") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Parser syntax & CBN docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Logstash/CBN parser syntax, grok patterns, and canonical UDM field mappings." },
        { label: "📖 Parser debugging guide", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for debugging custom parsers, dropped events, and timestamp extraction." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Test parser on sample log", category: "action", targetMcp: "action", prompt: "Test the active parser against sample log text using SecOps MCP run_parser to verify UDM field extraction." },
        { label: "⚡ Diagnose unparsed logs", category: "action", targetMcp: "action", prompt: "Check for unparsed logs and syntax errors for this log type using SecOps MCP." }
      ];
    } else {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: `📖 Explain ${title} docs`, category: "help", targetMcp: "help", prompt: `Search Google SecOps documentation for ${title} architecture, purpose, and configuration parameters.` },
        { label: "📖 Configuration best practices", category: "help", targetMcp: "help", prompt: `Search Google SecOps documentation for best practices when configuring ${title}.` },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Audit active inputs", category: "action", targetMcp: "action", prompt: `Audit the active on-screen input state for ${title} and verify compliance with SecOps settings guidelines.` },
        { label: "⚡ Check setting errors", category: "action", targetMcp: "action", prompt: `Analyze the visible errors on this ${title} page and check live settings using SecOps MCP.` }
      ];
    }
  } else if (fc.feature === "UDM Search") {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 UDM field reference", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for canonical UDM 2.0 field paths, nouns, and query operator syntax." },
      { label: "📖 Query optimization guide", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for indexing best practices, timestamp filter rules, and fast query structures." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Execute UDM query", category: "action", targetMcp: "action", prompt: "Execute the active UDM query across the selected time range using SecOps MCP and return top matching events." },
      { label: "⚡ Explain & optimize query", category: "action", targetMcp: "action", prompt: "Analyze the active UDM query, point out any syntax errors or missing indexes, and provide a refined version." },
      { label: "⚡ Convert to YARA-L rule", category: "action", targetMcp: "action", prompt: "Convert this UDM search query into a production-ready YARA-L 2.0 detection rule." }
    ];
  } else if (fc.feature === "YARA-L Rules Editor") {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 YARA-L 2.0 language docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for YARA-L 2.0 syntax, sliding windows, and regex match operators." },
      { label: "📖 Rule tuning & deduplication", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for detection tuning, hop deduplication, and alert suppression guidelines." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Validate rule syntax", category: "action", targetMcp: "action", prompt: "Validate the syntax and compilation of the active YARA-L rule against the live Google SecOps engine using SecOps MCP." },
      { label: "⚡ Query rule detections", category: "action", targetMcp: "action", prompt: "Query historical detections and alert state for this detection rule using SecOps MCP." },
      { label: "⚡ Troubleshoot compiler error", category: "action", targetMcp: "action", prompt: "Analyze the error message on this screen and validate the corrected YARA-L rule text using SecOps MCP." }
    ];
  } else if (fc.route === "breach-analytics" || (fc.feature && fc.feature.includes("Breach Analytics"))) {
    const timePromptPart = fc.timeWindow ? ` during the time window ${fc.timeWindow}` : "";
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 Breach Analytics scoring docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Mandiant Breach Analytics scoring models, confidence ratings, and high-severity IOC triage workflows." },
      { label: "📖 Threat actor attribution guide", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for threat actor attribution, attack campaigns, and Mandiant threat intelligence indicators." },
      { label: "📖 IOC false positive tuning", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for evaluating high-severity IOC matches and tuning false positive detections in Chronicle." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Summarize breach detections", category: "action", targetMcp: "action", prompt: `Analyze the active breach analytics detections and high-confidence IOC matches${timePromptPart} using SecOps MCP.` },
      { label: "⚡ Correlate breach IOCs", category: "action", targetMcp: "action", prompt: `Query live UDM telemetry for IOC matches detected${timePromptPart} using SecOps MCP to check for active compromise.` },
      { label: "⚡ Prioritize impacted assets", category: "action", targetMcp: "action", prompt: `Based on the breach detections${timePromptPart}, identify which internal host assets or user accounts are at highest risk.` }
    ];
  } else if (fc.route === "workdesk" || (fc.feature && fc.feature.startsWith("Workdesk •"))) {
    const subTab = fc.subTab || "cases";
    if (subTab === "pending-actions") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Playbook pending actions docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for SOAR playbook pending actions, manual approval steps, and action execution." },
        { label: "📖 Action timeout & escalation", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for playbook manual action timeouts, fallback conditions, and escalation paths." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ List pending playbook actions", category: "action", targetMcp: "action", prompt: "Review pending manual playbook actions requiring analyst decision and summarize the approval choices using SecOps MCP." },
        { label: "⚡ Inspect action payload", category: "action", targetMcp: "action", prompt: "Inspect the parameters and context for the pending playbook actions on screen using SecOps MCP." }
      ];
    } else if (subTab === "tasks") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Case tasks & checklists docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for case investigation tasks, playbook task templates, and analyst checklists." },
        { label: "📖 Task assignment best practices", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for SOAR task assignment workflows and role-based delegation." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Summarize pending tasks", category: "action", targetMcp: "action", prompt: "Analyze open investigation tasks in my queue and summarize blockers or overdue items using SecOps MCP." },
        { label: "⚡ Prioritize critical tasks", category: "action", targetMcp: "action", prompt: "Prioritize open tasks across active cases by SLA urgency using SecOps MCP." }
      ];
    } else if (subTab === "requests") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 SecOps requests workflow docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for security requests, analyst escalations, and ticket integration." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Review active requests", category: "action", targetMcp: "action", prompt: "Query active security requests and pending escalations using SecOps MCP." },
        { label: "⚡ Check request approval queue", category: "action", targetMcp: "action", prompt: "Inspect open security access or triage requests awaiting review." }
      ];
    } else if (subTab === "workspace") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Analyst workspace docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for customizing the Workdesk workspace, metric widgets, and personal dashboards." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ SOC metric overview", category: "action", targetMcp: "action", prompt: "Query key SOC metrics (open case count, average triage time, high-severity alerts) using SecOps MCP." },
        { label: "⚡ Summarize queue health", category: "action", targetMcp: "action", prompt: "Summarize overall SOC queue health and case backlog using SecOps MCP." }
      ];
    } else if (subTab === "announcements") {
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 SOC announcements docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for SOC broadcast announcements, handoff logs, and shift handover bulletins." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Summarize announcements", category: "action", targetMcp: "action", prompt: "Summarize key operational bulletins and security announcements visible on screen." }
      ];
    } else {
      // Default Workdesk subTab: cases
      chips = [
        // Help suggestions (Developer Knowledge MCP)
        { label: "📖 Case queue & SLA docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Workdesk case queue management, SLA tracking, and assignment rules." },
        { label: "📖 Case escalation workflow", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for case escalation, priority recalculation, and analyst reassignment." },
        // Action suggestions (SecOps MCP)
        { label: "⚡ Prioritize my open cases", category: "action", targetMcp: "action", prompt: "List and prioritize open cases assigned to the current analyst by severity and SLA urgency using SecOps MCP." },
        { label: "⚡ Check case alert volume", category: "action", targetMcp: "action", prompt: "Check recent alert volume and critical alert triggers for cases in my queue using SecOps MCP." },
        { label: "⚡ Triage stale cases", category: "action", targetMcp: "action", prompt: "Identify open cases in my queue with no updates or activity in the last 24 hours using SecOps MCP." }
      ];
    }
  } else if (fc.route === "soar-search" || fc.feature === "SOAR Search") {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 SOAR global search docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for SOAR search syntax, cross-entity search, and playbook lookup operators." },
      { label: "📖 Entity investigation guide", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for investigating IP addresses, hostnames, and user identities in SOAR." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Search active cases & alerts", category: "action", targetMcp: "action", prompt: "Search for open cases and high-severity security alerts related to the active query using SecOps MCP." },
      { label: "⚡ Correlate entity across cases", category: "action", targetMcp: "action", prompt: "Search for all cases and alerts involving the query entity using SecOps MCP list_cases." }
    ];
  } else if (fc.route === "data-tables" || fc.feature === "Data Tables" || (fc.feature && fc.feature.startsWith("Data Table •"))) {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 Data Tables & Reference Lists docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Data Tables, Reference Lists, and UDM lookup enrichment workflows." },
      { label: "📖 Data table schema & types", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for data table column types, row quotas, and YARA-L table lookup functions." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ List tenant data tables", category: "action", targetMcp: "action", prompt: "List and summarize custom Data Tables and Reference Lists in the tenant using SecOps MCP." },
      { label: "⚡ Inspect table schema & rows", category: "action", targetMcp: "action", prompt: "Inspect column definitions and recent row entries for the active data table using SecOps MCP." }
    ];
  } else if (fc.route === "threats" || fc.feature === "Applied Threat Intelligence" || (fc.feature && fc.feature.startsWith("Threats •"))) {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 Mandiant Threat Intel docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Applied Threat Intelligence, Mandiant threat actor profiles, and IOC feeds." },
      { label: "📖 Threat campaign tracking", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for tracking threat campaigns, malware families, and actor attribution in Chronicle." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Correlate threat actor IOCs", category: "action", targetMcp: "action", prompt: "Query threat actor indicators visible on screen and search for matching telemetry in UDM using SecOps MCP." },
      { label: "⚡ Audit high-severity IOC matches", category: "action", targetMcp: "action", prompt: "Query recent IOC matches and threat intelligence hits across tenant telemetry using SecOps MCP." }
    ];
  } else if (fc.route === "curated-rules" || fc.feature === "Curated Rules") {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 Curated Rule Sets docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for Chronicle Curated Detection Rule Sets, threat categories, and precision tuning." },
      { label: "📖 Curated rule tuning & exclusions", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for configuring rule exclusions, alert suppression, and false positive tuning in curated rule sets." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Review curated rule coverage", category: "action", targetMcp: "action", prompt: "Evaluate rule coverage and review enabled curated rule categories across the tenant using SecOps MCP." },
      { label: "⚡ Audit curated rule alert volume", category: "action", targetMcp: "action", prompt: "Check recent security alerts triggered by curated rule sets using SecOps MCP." }
    ];
  } else if (fc.route === "rules" || fc.feature === "YARA-L Rules") {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 YARA-L 2.0 overview docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for YARA-L 2.0 rule structure, syntax, and detection best practices." },
      { label: "📖 Rule deployment & testing", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for live vs test rule execution, retrohunts, and frequency limits." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ List detection rules", category: "action", targetMcp: "action", prompt: "Query active YARA-L detection rules and summarize their enabled/disabled state using SecOps MCP." },
      { label: "⚡ Check rule execution errors", category: "action", targetMcp: "action", prompt: "Query rule execution errors across active detection rules in the tenant using SecOps MCP." }
    ];
  } else {
    chips = [
      // Help suggestions (Developer Knowledge MCP)
      { label: "📖 Search SecOps docs", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for guidance and architecture regarding the active screen." },
      { label: "📖 Chronicle best practices", category: "help", targetMcp: "help", prompt: "Search Google SecOps documentation for operational best practices related to this workflow." },
      // Action suggestions (SecOps MCP)
      { label: "⚡ Explore open cases", category: "action", targetMcp: "action", prompt: "Query recent open high-severity cases in Google SecOps using SecOps MCP." },
      { label: "⚡ Check security alerts", category: "action", targetMcp: "action", prompt: "List recent security alerts generated across the tenant using SecOps MCP." },
      { label: "⚡ Build YARA-L rule", category: "action", targetMcp: "action", prompt: "Help me construct a YARA-L 2.0 rule based on the current context using SecOps MCP." }
    ];
  }

  // Update counts in filter tabs
  const helpCount = chips.filter((c) => c.category === "help").length;
  const actionCount = chips.filter((c) => c.category === "action").length;
  const totalCount = chips.length;

  if (filterTabAll) filterTabAll.innerHTML = `<span>All</span> <span class="tab-count">(${totalCount})</span>`;
  if (filterTabHelp) filterTabHelp.innerHTML = `
    <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
    <span>Help</span> <span class="tab-count">(${helpCount})</span>
  `;
  if (filterTabAction) filterTabAction.innerHTML = `
    <svg class="tab-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
    <span>Action</span> <span class="tab-count">(${actionCount})</span>
  `;

  // Filter chips based on active tab
  const visibleChips = chips.filter((c) => {
    if (currentSuggestionFilter === "all") return true;
    return c.category === currentSuggestionFilter;
  });

  quickActions.innerHTML = visibleChips.map((c) => {
    const isHelp = c.category === "help";
    const cleanLabel = c.label.replace(/^[📖⚡✨]\s*/, "");
    const iconSvg = isHelp
      ? `<svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`
      : `<svg class="chip-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    return `<button class="chip chip-${c.category}" data-prompt="${escapeHtml(c.prompt)}" data-target-mcp="${c.targetMcp}" data-category="${c.category}">${iconSvg}<span>${escapeHtml(cleanLabel)}</span></button>`;
  }).join("");
}

// Suggestions Filter Bar Click Listener
if (suggestionsFilterBar) {
  suggestionsFilterBar.addEventListener("click", (e) => {
    const tab = e.target.closest(".filter-tab");
    if (!tab) return;
    const filter = tab.getAttribute("data-filter");
    if (!filter) return;

    currentSuggestionFilter = filter;
    suggestionsFilterBar.querySelectorAll(".filter-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    if (currentContext) {
      renderQuickActionChips(currentContext);
    }
  });
}

// Quick action button handlers supporting dynamic data-prompt and targetMcp
quickActions.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;

  let prompt = chip.getAttribute("data-prompt");
  const targetMcp = chip.getAttribute("data-target-mcp") || (currentSuggestionFilter !== "all" ? currentSuggestionFilter : "all");

  if (!prompt) {
    const action = chip.getAttribute("data-action");
    if (action === "troubleshoot") {
      prompt = "Search Google SecOps documentation to troubleshoot what went wrong and provide the fix.";
    } else if (action === "udm") {
      prompt = "Execute the active UDM query using SecOps MCP and analyze matching events.";
    } else if (action === "yara") {
      prompt = "Validate the syntax and condition logic of the active YARA-L rule against Google SecOps.";
    } else if (action === "docs") {
      prompt = "Search Google SecOps documentation to explain how to configure and use this feature.";
    }
  }

  if (prompt) {
    handleSendMessage(prompt, { targetMcp });
  }
});

/**
 * 4. UI Controls & Settings Modal
 */
if (headerMenuBtn && headerMenuDropdown) {
  headerMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isExpanded = !headerMenuDropdown.classList.contains("hidden");
    headerMenuDropdown.classList.toggle("hidden");
    headerMenuBtn.setAttribute("aria-expanded", String(!isExpanded));
  });

  document.addEventListener("click", (e) => {
    if (!headerMenuDropdown.contains(e.target) && !headerMenuBtn.contains(e.target)) {
      headerMenuDropdown.classList.add("hidden");
      headerMenuBtn.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !headerMenuDropdown.classList.contains("hidden")) {
      headerMenuDropdown.classList.add("hidden");
      headerMenuBtn.setAttribute("aria-expanded", "false");
      headerMenuBtn.focus();
    }
  });
}

inspectContextBtn.addEventListener("click", () => {
  contextInspector.classList.toggle("hidden");
  const isHidden = contextInspector.classList.contains("hidden");
  const labelSpan = inspectContextBtn.querySelector(".menu-item-label");
  if (labelSpan) {
    labelSpan.textContent = isHidden ? "Inspect Context Payload" : "Hide Context Payload";
  } else {
    inspectContextBtn.textContent = isHidden ? "Inspect" : "Hide";
  }
  if (headerMenuDropdown) {
    headerMenuDropdown.classList.add("hidden");
    if (headerMenuBtn) headerMenuBtn.setAttribute("aria-expanded", "false");
  }
});

refreshContextBtn.addEventListener("click", () => {
  syncActiveTab();
});

clearChatBtn.addEventListener("click", () => {
  conversationHistory = [];
  messagesContainer.innerHTML = `
    <div class="message assistant welcome">
      <div class="message-content">
        <p><strong>Chat cleared.</strong> Ready for your next SecOps task or query!</p>
      </div>
    </div>
  `;
});

// Settings Modal Management
settingsBtn.addEventListener("click", async () => {
  const settings = await window.SecOpsAuthService.getSettings();
  document.querySelector(`input[name="authMode"][value="${settings.authMode}"]`).checked = true;
  apiKeyInput.value = settings.apiKey || "";
  gcpProjectInput.value = settings.gcpProject || "";
  gcpRegionInput.value = settings.gcpRegion || "global";
  if (oauthClientIdInput) {
    const manifestClientId = chrome.runtime.getManifest().oauth2?.client_id || "";
    oauthClientIdInput.value = settings.oauthClientId || (manifestClientId.includes("YOUR_CLIENT_ID") ? "" : manifestClientId);
  }
  modelSelect.value = settings.model || "gemini-3.8-flash";
  if (mcpGroundingCheckbox) {
    mcpGroundingCheckbox.checked = settings.enableMcp !== false;
  }
  if (secopsMcpCheckbox) {
    secopsMcpCheckbox.checked = settings.enableSecOpsMcp !== false;
  }
  if (secopsCustomerIdInput) {
    secopsCustomerIdInput.value = settings.secopsCustomerId || "";
  }
  if (secopsRegionInput) {
    secopsRegionInput.value = settings.secopsRegion || "us";
  }
  toggleAuthInputs(settings.authMode);
  settingsStatus.textContent = "";
  settingsModal.classList.remove("hidden");
});

closeSettingsBtn.addEventListener("click", () => {
  settingsModal.classList.add("hidden");
});

document.querySelectorAll('input[name="authMode"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    toggleAuthInputs(e.target.value);
  });
});

function toggleAuthInputs(mode) {
  if (mode === "vertexOAuth") {
    apiKeyGroup.classList.add("hidden");
    vertexGroup.classList.remove("hidden");
  } else {
    apiKeyGroup.classList.remove("hidden");
    vertexGroup.classList.add("hidden");
  }
}

saveSettingsBtn.addEventListener("click", async () => {
  const authMode = document.querySelector('input[name="authMode"]:checked').value;
  const newSettings = {
    authMode: authMode,
    apiKey: apiKeyInput.value.trim(),
    gcpProject: gcpProjectInput.value.trim(),
    gcpRegion: gcpRegionInput.value.trim() || "global",
    oauthClientId: oauthClientIdInput ? oauthClientIdInput.value.trim() : "",
    model: modelSelect.value,
    enableMcp: mcpGroundingCheckbox ? mcpGroundingCheckbox.checked : true,
    enableSecOpsMcp: secopsMcpCheckbox ? secopsMcpCheckbox.checked : true,
    secopsCustomerId: secopsCustomerIdInput ? secopsCustomerIdInput.value.trim() : "",
    secopsRegion: secopsRegionInput ? (secopsRegionInput.value.trim() || "us") : "us"
  };

  await window.SecOpsAuthService.saveSettings(newSettings);
  settingsStatus.textContent = "Settings saved successfully!";
  settingsStatus.className = "status-msg success";

  setTimeout(() => {
    settingsModal.classList.add("hidden");
  }, 700);
});


// Screenshot capture and removal handlers
if (captureScreenBtn) {
  captureScreenBtn.addEventListener("click", async () => {
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const capture = (windowId) => {
          chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (url) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!url) {
              reject(new Error("Unable to capture active tab"));
            } else {
              resolve(url);
            }
          });
        };

        if (chrome.windows && chrome.windows.getLastFocused) {
          chrome.windows.getLastFocused({ populate: false }, (win) => {
            capture(win ? win.id : null);
          });
        } else {
          capture(null);
        }
      });

      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
      attachedImage = {
        mimeType: "image/png",
        data: base64Data,
        previewUrl: dataUrl
      };

      if (imageThumbnail) imageThumbnail.src = dataUrl;
      if (imagePreviewContainer) imagePreviewContainer.style.display = "flex";
      chatInput.focus();
    } catch (err) {
      console.warn("Screenshot capture error:", err);
      alert(`Could not capture screen: ${err.message}`);
    }
  });
}

if (removeImageBtn) {
  removeImageBtn.addEventListener("click", () => {
    attachedImage = null;
    if (imageThumbnail) imageThumbnail.src = "";
    if (imagePreviewContainer) imagePreviewContainer.style.display = "none";
  });
}

/**
 * Active Skill & Slash Command System
 */
function setActiveOnDemandSkill(skill) {
  activeOnDemandSkill = skill;
  if (!activeSkillChipContainer || !activeSkillChipName) return;

  if (skill) {
    const cmd = skill.command || `/${skill.id}`;
    activeSkillChipName.textContent = cmd;
    activeSkillChipContainer.style.display = "flex";
    if (chatInput) {
      chatInput.placeholder = `Pass ID or parameters for ${cmd} (e.g. 106616)...`;
    }
  } else {
    activeSkillChipContainer.style.display = "none";
    if (chatInput) {
      chatInput.placeholder = "Ask a question or type / for skills (e.g. /grill-me)...";
    }
  }
}

if (removeActiveSkillBtn) {
  removeActiveSkillBtn.addEventListener("click", () => {
    setActiveOnDemandSkill(null);
    chatInput.focus();
  });
}

async function updateAmbientSkillsIndicator() {
  if (!ambientSkillsText || !window.SecOpsSkillManager) return;
  try {
    const ambients = await window.SecOpsSkillManager.getAmbientSkills();
    if (ambients.length === 0) {
      ambientSkillsText.textContent = "0 Skills";
    } else if (ambients.length === 1) {
      ambientSkillsText.textContent = ambients[0].name;
    } else {
      ambientSkillsText.textContent = `${ambients.length} Skills`;
    }
  } catch (err) {
    console.warn("Could not update ambient skills indicator:", err);
  }
}

async function handleChatInputChange() {
  const text = chatInput.value;

  if (text.startsWith("/")) {
    // If user has started typing arguments after space, hide autocomplete
    const firstSpace = text.indexOf(" ");
    if (firstSpace !== -1) {
      hideSlashMenu();
      return;
    }

    const query = text.slice(1).trim().toLowerCase();
    if (!window.SecOpsSkillManager) return;

    try {
      const allSkills = await window.SecOpsSkillManager.getEnabledSkills();
      currentSlashMatches = allSkills.filter((s) => {
        const cmd = (s.command || s.id || "").toLowerCase().replace(/^\//, "");
        const name = (s.name || "").toLowerCase();
        const desc = (s.description || "").toLowerCase();
        return !query || cmd.includes(query) || name.includes(query) || desc.includes(query);
      });

      if (currentSlashMatches.length > 0) {
        selectedSlashIndex = 0;
        renderSlashMenu();
        if (slashCommandMenu) {
          slashCommandMenu.classList.remove("hidden");
          slashCommandMenu.style.display = "block";
        }
      } else {
        hideSlashMenu();
      }
    } catch (e) {
      console.warn("Error fetching skills for slash menu:", e);
      hideSlashMenu();
    }
  } else {
    hideSlashMenu();
  }
}

function renderSlashMenu() {
  if (!slashMenuList) return;
  slashMenuList.innerHTML = currentSlashMatches.map((skill, idx) => {
    const isSelected = idx === selectedSlashIndex;
    const cmd = skill.command ? (skill.command.startsWith("/") ? skill.command : `/${skill.command}`) : `/${skill.id}`;
    return `
      <div class="slash-menu-item ${isSelected ? "selected" : ""}" data-index="${idx}">
        <div class="slash-item-left">
          <span class="slash-item-cmd">${escapeHtml(cmd)}</span>
          <span class="slash-item-desc">${escapeHtml(skill.name)}${skill.description ? ` &ndash; ${escapeHtml(skill.description)}` : ""}</span>
        </div>
        <span class="slash-item-badge">${escapeHtml(skill.mode || "on-demand")}</span>
      </div>
    `;
  }).join("");

  slashMenuList.querySelectorAll(".slash-menu-item").forEach((item) => {
    // mousedown prevents chatInput from blurring before the item is selected
    item.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const idx = parseInt(item.getAttribute("data-index"), 10);
      selectSlashItem(idx);
    });
    item.addEventListener("click", () => {
      const idx = parseInt(item.getAttribute("data-index"), 10);
      selectSlashItem(idx);
    });
  });
}

function selectSlashItem(index) {
  if (index < 0 || index >= currentSlashMatches.length) return;
  const chosen = currentSlashMatches[index];
  setActiveOnDemandSkill(chosen);
  chatInput.value = "";
  chatInput.style.height = "auto";
  hideSlashMenu();
  chatInput.focus();
}

function hideSlashMenu() {
  if (slashCommandMenu) {
    slashCommandMenu.classList.add("hidden");
    slashCommandMenu.style.display = "none";
  }
  if (slashMenuList) {
    slashMenuList.innerHTML = "";
  }
  currentSlashMatches = [];
  selectedSlashIndex = 0;
}

// Dismiss slash command menu on click outside
document.addEventListener("click", (e) => {
  if (slashCommandMenu && !slashCommandMenu.contains(e.target) && e.target !== chatInput) {
    hideSlashMenu();
  }
});

chatInput.addEventListener("blur", () => {
  setTimeout(() => {
    hideSlashMenu();
  }, 200);
});

if (ambientSkillsPill) {
  ambientSkillsPill.addEventListener("click", () => {
    if (headerMenuDropdown) {
      headerMenuDropdown.classList.add("hidden");
      if (headerMenuBtn) headerMenuBtn.setAttribute("aria-expanded", "false");
    }
    renderSkillsList();
    if (skillsModal) skillsModal.classList.remove("hidden");
  });
}

// Chat Input Auto-Resize & Enter submission
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  handleChatInputChange();
});

chatInput.addEventListener("keyup", (e) => {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter" && e.key !== "Escape") {
    handleChatInputChange();
  }
});

chatInput.addEventListener("keydown", (e) => {
  if (slashCommandMenu && !slashCommandMenu.classList.contains("hidden") && currentSlashMatches.length > 0) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedSlashIndex = (selectedSlashIndex + 1) % currentSlashMatches.length;
      renderSlashMenu();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedSlashIndex = (selectedSlashIndex - 1 + currentSlashMatches.length) % currentSlashMatches.length;
      renderSlashMenu();
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      selectSlashItem(selectedSlashIndex);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      hideSlashMenu();
      return;
    }
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

sendBtn.addEventListener("click", () => {
  handleSendMessage();
});

// Unslop toggle persistence
if (unslopToggle) {
  unslopToggle.addEventListener("change", () => {
    const enabled = unslopToggle.checked;
    chrome.storage.local.set({ unslopEnabled: enabled });
    if (window.SecOpsSkillManager) {
      window.SecOpsSkillManager.toggleSkill("unslop", enabled);
    }
    updateAmbientSkillsIndicator();
  });
}


/**
 * 6. Skills Management UI Controller
 */
async function renderSkillsList() {
  if (!skillsListContainer || !window.SecOpsSkillManager) return;
  const skills = await window.SecOpsSkillManager.getSkills();

  if (skills.length === 0) {
    skillsListContainer.innerHTML = '<p class="hint">No skills installed.</p>';
    return;
  }

  skillsListContainer.innerHTML = skills.map((skill) => {
    const isChecked = skill.enabled !== false;
    const tagLabel = skill.isBuiltin ? "Built-in" : (skill.tags?.[0] || "Custom");
    const tagClass = skill.isBuiltin ? "builtin" : "";

    return `
      <div class="skill-card ${isChecked ? "" : "disabled"}" id="card-${escapeHtml(skill.id)}">
        <div class="skill-header">
          <div class="skill-title-area">
            <span class="skill-name">${escapeHtml(skill.name)}</span>
            <span class="skill-tag ${skill.mode === "ambient" ? "builtin" : ""}">${skill.mode === "ambient" ? "Ambient" : (skill.command || "On-Demand")}</span>
          </div>
          <label class="toggle-switch-wrapper" style="margin: 0;">
            <input type="checkbox" class="skill-checkbox" data-id="${escapeHtml(skill.id)}" ${isChecked ? "checked" : ""}>
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div class="skill-desc">${escapeHtml(skill.description || "No description provided.")}</div>
        <div class="skill-actions">
          <button class="skill-btn toggle-preview-btn" data-id="${escapeHtml(skill.id)}">View Directive</button>
          ${skill.isBuiltin ? "" : `<button class="skill-btn delete delete-skill-btn" data-id="${escapeHtml(skill.id)}">Delete</button>`}
        </div>
        <div class="skill-content-preview hidden" id="preview-${escapeHtml(skill.id)}">${escapeHtml(skill.content)}</div>
      </div>
    `;
  }).join("");

  // Re-bind listeners for checkboxes, view, and delete
  skillsListContainer.querySelectorAll(".skill-checkbox").forEach((cb) => {
    cb.addEventListener("change", async (e) => {
      const skillId = e.target.getAttribute("data-id");
      const enabled = e.target.checked;
      await window.SecOpsSkillManager.toggleSkill(skillId, enabled);
      const card = document.getElementById(`card-${skillId}`);
      if (card) {
        if (enabled) card.classList.remove("disabled");
        else card.classList.add("disabled");
      }
      updateAmbientSkillsIndicator();
      if (skillId === "unslop" && unslopToggle) {
        unslopToggle.checked = enabled;
      }
    });
  });

  skillsListContainer.querySelectorAll(".toggle-preview-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const skillId = e.target.getAttribute("data-id");
      const previewEl = document.getElementById(`preview-${skillId}`);
      if (previewEl) {
        const isHidden = previewEl.classList.contains("hidden");
        previewEl.classList.toggle("hidden");
        btn.textContent = isHidden ? "Hide Directive" : "View Directive";
      }
    });
  });

  skillsListContainer.querySelectorAll(".delete-skill-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const skillId = e.target.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this custom skill?")) {
        await window.SecOpsSkillManager.deleteSkill(skillId);
        renderSkillsList();
      }
    });
  });
}

if (skillsBtn) {
  skillsBtn.addEventListener("click", () => {
    if (headerMenuDropdown) {
      headerMenuDropdown.classList.add("hidden");
      if (headerMenuBtn) headerMenuBtn.setAttribute("aria-expanded", "false");
    }
    renderSkillsList();
    skillsModal.classList.remove("hidden");
  });
}

if (closeSkillsBtn) {
  closeSkillsBtn.addEventListener("click", () => {
    skillsModal.classList.add("hidden");
  });
}

if (showAddSkillBtn) {
  showAddSkillBtn.addEventListener("click", () => {
    addSkillPanel.classList.toggle("hidden");
  });
}

document.querySelectorAll(".skill-tab-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    document.querySelectorAll(".skill-tab-btn").forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");
    const tabName = e.target.getAttribute("data-tab");
    if (tabName === "importUrl") {
      document.getElementById("importUrlForm").classList.remove("hidden");
      document.getElementById("customSkillForm").classList.add("hidden");
    } else {
      document.getElementById("importUrlForm").classList.add("hidden");
      document.getElementById("customSkillForm").classList.remove("hidden");
    }
  });
});

if (fetchSkillBtn) {
  fetchSkillBtn.addEventListener("click", async () => {
    const url = skillUrlInput.value.trim();
    if (!url) return;
    addSkillStatus.textContent = "Fetching SKILL.md from URL...";
    addSkillStatus.className = "status-msg";

    try {
      await window.SecOpsSkillManager.importFromUrl(url);
      addSkillStatus.textContent = "Skill installed successfully!";
      addSkillStatus.className = "status-msg success";
      skillUrlInput.value = "";
      renderSkillsList();
      setTimeout(() => {
        addSkillPanel.classList.add("hidden");
        addSkillStatus.textContent = "";
      }, 900);
    } catch (err) {
      addSkillStatus.textContent = `Error: ${err.message}`;
      addSkillStatus.className = "status-msg error";
    }
  });
}

if (saveCustomSkillBtn) {
  saveCustomSkillBtn.addEventListener("click", async () => {
    const name = customSkillName.value.trim();
    const desc = customSkillDesc.value.trim();
    const content = customSkillContent.value.trim();

    if (!name || !content) {
      addSkillStatus.textContent = "Skill Name and Markdown instructions are required.";
      addSkillStatus.className = "status-msg error";
      return;
    }

    try {
      const parsed = window.SecOpsSkillManager.parseSkillMarkdown(content);
      const skill = {
        id: `custom-${Date.now().toString(36)}`,
        name: name || parsed.name,
        description: desc || parsed.description,
        tags: parsed.tags.length > 0 ? parsed.tags : ["custom"],
        enabled: true,
        isBuiltin: false,
        content: parsed.content || content
      };

      await window.SecOpsSkillManager.saveSkill(skill);
      addSkillStatus.textContent = "Skill saved successfully!";
      addSkillStatus.className = "status-msg success";

      customSkillName.value = "";
      customSkillDesc.value = "";
      customSkillContent.value = "";
      renderSkillsList();
      setTimeout(() => {
        addSkillPanel.classList.add("hidden");
        addSkillStatus.textContent = "";
      }, 900);
    } catch (err) {
      addSkillStatus.textContent = `Error: ${err.message}`;
      addSkillStatus.className = "status-msg error";
    }
  });
}

// Initialize on load
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get({ unslopEnabled: true, aiPointerEnabled: true }, (res) => {
    if (unslopToggle) {
      unslopToggle.checked = res.unslopEnabled !== false;
    }
    if (aiPointerToggle) {
      aiPointerToggle.checked = res.aiPointerEnabled !== false;
    }
  });

  if (aiPointerToggle) {
    aiPointerToggle.addEventListener("change", () => {
      chrome.storage.local.set({ aiPointerEnabled: aiPointerToggle.checked });
    });
  }

  syncActiveTab();
  updateAmbientSkillsIndicator();
});
