/**
 * YARA-L Rules & Curated Rules Extractor
 * Supports:
 * - /rules (YARA-L Rules Dashboard or Editor)
 * - /rule-editor or /rules/editor (YARA-L Rules Editor)
 * - /chronicleAnalytics/ruleSets (Curated Rules)
 */
window.SecOpsRulesExtractor = {
  matches(url) {
    const lower = url.toLowerCase();
    return (
      lower.includes("/rules") ||
      lower.includes("/detection/rules") ||
      lower.includes("/rule-editor") ||
      lower.includes("/chronicleanalytics/rulesets") ||
      lower.includes("rulesets")
    );
  },

  extract() {
    const url = window.location.href;
    const lower = url.toLowerCase();
    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    // 1. Curated Rules route (/chronicleAnalytics/ruleSets)
    if (lower.includes("/chronicleanalytics/rulesets") || lower.includes("rulesets")) {
      const visibleRuleSets = [];
      document.querySelectorAll(".ruleset-card, .rule-set-item, table tbody tr, [role='row']").forEach((el) => {
        const text = el.innerText.replace(/\s+/g, " ").trim();
        if (text && text.length > 5 && visibleRuleSets.length < 12) {
          visibleRuleSets.push(window.SecOpsDOMUtils.truncate(text, 160));
        }
      });

      return {
        feature: "Curated Rules",
        route: "curated-rules",
        ruleSetsCount: visibleRuleSets.length,
        visibleRuleSets: visibleRuleSets.length > 0 ? visibleRuleSets : null,
        detectedErrors: errors.length > 0 ? errors : null
      };
    }

    // 2. YARA-L Rules Editor (detected by code editor element or specific editor URL)
    const code = window.SecOpsDOMUtils.extractCodeEditorContent();
    const isEditorUrl = lower.includes("/rule-editor") || lower.includes("/rules/editor") || lower.includes("edit=true");
    const hasEditorDom = document.querySelector(".monaco-editor, .ace_editor, textarea.code-editor, [data-testid='rule-code-editor']") !== null;

    if (code || isEditorUrl || hasEditorDom) {
      // Extract Rule Name from header or input field
      let ruleName = null;
      const nameEl = document.querySelector(
        "input[placeholder*='Rule name'], .rule-name-header, [data-testid='rule-name-input'], h1.rule-title"
      );
      if (nameEl) {
        ruleName = nameEl.value || nameEl.textContent;
        if (ruleName) ruleName = ruleName.trim();
      }

      // Extract rule validation / linter error callouts specifically in editor
      const linterErrors = [];
      document.querySelectorAll(".monaco-editor .squiggly-error, .ace_error, .marker-error").forEach((el) => {
        const title = el.getAttribute("title") || el.getAttribute("aria-label");
        if (title && !linterErrors.includes(title)) {
          linterErrors.push(title.trim());
        }
      });

      const combinedErrors = [...new Set([...errors, ...linterErrors])];

      return {
        feature: "YARA-L Rules Editor",
        route: "rules-editor",
        ruleName: ruleName || "Untitled Rule",
        ruleCode: code ? window.SecOpsDOMUtils.truncate(code, 6000) : "No rule code detected in editor",
        detectedErrors: combinedErrors.length > 0 ? combinedErrors : null
      };
    }

    // 3. YARA-L Rules List / Dashboard (/rules)
    const visibleRules = [];
    document.querySelectorAll("table tbody tr, .rule-row, [role='row']").forEach((row) => {
      const text = row.innerText.replace(/\s+/g, " ").trim();
      if (text && text.length > 5 && visibleRules.length < 12) {
        visibleRules.push(window.SecOpsDOMUtils.truncate(text, 160));
      }
    });

    return {
      feature: "YARA-L Rules",
      route: "rules",
      rulesCount: visibleRules.length,
      visibleRules: visibleRules.length > 0 ? visibleRules : null,
      detectedErrors: errors.length > 0 ? errors : null
    };
  }
};
