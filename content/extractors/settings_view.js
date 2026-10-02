/**
 * Settings & Administration Extractor
 * Extracts configuration state from /settings/* (e.g. email-domains, data-tables, feeds, parsers)
 */
window.SecOpsSettingsExtractor = {
  matches(url) {
    return (
      url.includes("/settings") ||
      url.includes("/admin") ||
      url.includes("/configuration")
    );
  },

  extract() {
    const url = window.location.href;

    // 1. Identify Setting Section from URL (e.g. /settings/email-domains)
    let settingSlug = "general";
    const match = url.match(/(?:\/settings|\/admin|\/configuration)\/([a-zA-Z0-9_\-]+)/i);
    if (match && match[1]) {
      settingSlug = match[1].toLowerCase();
    }

    // Mapping for common SecOps / Chronicle settings
    const settingDefinitions = {
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

    const info = settingDefinitions[settingSlug] || {
      title: settingSlug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      purpose: "Google SecOps console administrative setting."
    };

    const featureName = `Settings • ${info.title}`;

    // 2. Extract Visible Configuration Items (table rows, chips, or list items)
    const items = [];

    // Search for table rows (common in email-domains, feeds, data-tables)
    const tableRows = document.querySelectorAll("table tbody tr, [role='row']");
    tableRows.forEach((row) => {
      if (items.length >= 25) return;
      const cells = Array.from(row.querySelectorAll("td, [role='cell']"))
        .map((c) => c.textContent.trim())
        .filter(Boolean);

      if (cells.length > 0) {
        items.push(cells.join(" | "));
      }
    });

    // If no table rows, check for tag chips or badge items
    if (items.length === 0) {
      document.querySelectorAll(".domain-chip, .tag-chip, .list-item, [class*='chip'], [class*='badge']").forEach((el) => {
        if (items.length >= 25) return;
        const text = el.textContent.trim();
        if (text && !items.includes(text) && text.length < 100) {
          items.push(text);
        }
      });
    }

    // 3. Extract Active Form Input State (if user is currently adding/editing)
    let activeInputs = [];
    document.querySelectorAll("input[type='text'], input[type='email'], input[type='search'], textarea").forEach((inp) => {
      const val = inp.value.trim();
      const placeholder = inp.placeholder || inp.getAttribute("aria-label") || "";
      if (val || placeholder) {
        activeInputs.push(`${placeholder ? `[${placeholder}] ` : ""}${val}`);
      }
    });

    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    return {
      feature: featureName,
      settingSlug: settingSlug,
      settingTitle: info.title,
      settingPurpose: info.purpose,
      configuredItems: items.length > 0 ? items : null,
      activeInputs: activeInputs.length > 0 ? activeInputs.slice(0, 5) : null,
      detectedErrors: errors.length > 0 ? errors : null
    };
  }
};
