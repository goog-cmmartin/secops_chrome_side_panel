/**
 * DOM Utility functions for extracting high-signal SecOps context
 */
window.SecOpsDOMUtils = {
  /**
   * Safely get user-selected text on the current page
   */
  extractSelection() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return selection.toString().trim();
    }
    return null;
  },

  /**
   * Extract code or query text from Monaco, Ace, CodeMirror, or textarea editors
   */
  extractCodeEditorContent(container = document) {
    // 1. Monaco Editor lines (used across modern Google Cloud and SecOps)
    const monacoLines = container.querySelectorAll(".monaco-editor .view-line");
    if (monacoLines && monacoLines.length > 0) {
      return Array.from(monacoLines)
        .map((line) => line.textContent || "")
        .join("\n")
        .trim();
    }

    // 2. Ace Editor lines (legacy Chronicle editors)
    const aceLines = container.querySelectorAll(".ace_editor .ace_line");
    if (aceLines && aceLines.length > 0) {
      return Array.from(aceLines)
        .map((line) => line.textContent || "")
        .join("\n")
        .trim();
    }

    // 3. CodeMirror lines
    const cmLines = container.querySelectorAll(".CodeMirror-line");
    if (cmLines && cmLines.length > 0) {
      return Array.from(cmLines)
        .map((line) => line.textContent || "")
        .join("\n")
        .trim();
    }

    // 4. Fallback: Search input or textarea
    const queryInput = container.querySelector(
      "textarea[data-testid='search-input'], input[data-testid='search-input'], textarea.query-input, textarea"
    );
    if (queryInput && queryInput.value) {
      return queryInput.value.trim();
    }

    return null;
  },

  /**
   * Extract visible error alerts, warnings, and toast notifications
   */
  extractErrorBanners(container = document) {
    const errorSelectors = [
      "[role='alert']",
      ".error-banner",
      ".mat-error",
      ".toast-error",
      ".notification-error",
      ".alert-danger",
      ".cdk-overlay-pane .error-message",
      ".syntax-error",
      ".compiler-error"
    ];

    const errors = [];
    const elements = container.querySelectorAll(errorSelectors.join(", "));
    elements.forEach((el) => {
      // Ensure element is visible and has text
      if (el.offsetParent !== null && el.textContent) {
        const text = el.textContent.replace(/\s+/g, " ").trim();
        if (text && !errors.includes(text) && text.length > 3) {
          errors.push(text);
        }
      }
    });

    return errors;
  },

  /**
   * Truncate text to a maximum character budget to prevent token blowup
   */
  truncate(text, maxChars = 4000) {
    if (!text) return "";
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + "\n...[truncated for token budget]...";
  },

  /**
   * Inject text into the active comment box or primary text area on the active SecOps page
   * @param {string} text
   * @returns {{ success: boolean, reason?: string }}
   */
  insertTextIntoActiveInput(text) {
    if (!text) {
      return { success: false, reason: "No text provided to insert" };
    }

    const selectors = [
      "textarea[placeholder*='comment' i]",
      "textarea[placeholder*='note' i]",
      "textarea[placeholder*='write' i]",
      "textarea[placeholder*='reply' i]",
      "div[data-testid='comment-input'] textarea",
      ".case-wall-comment-input textarea",
      ".wall-comment-input",
      "textarea",
      "[contenteditable='true']"
    ];

    let targetEl = null;
    for (const sel of selectors) {
      const candidates = document.querySelectorAll(sel);
      for (const el of candidates) {
        if (el.offsetParent !== null) {
          targetEl = el;
          break;
        }
      }
      if (targetEl) break;
    }

    if (!targetEl) {
      return {
        success: false,
        reason: "Could not find a visible comment box or text field on this page."
      };
    }

    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.focus();

    if (targetEl.tagName === "TEXTAREA" || targetEl.tagName === "INPUT") {
      const existing = targetEl.value;
      targetEl.value = existing ? `${existing}\n\n${text}` : text;
      targetEl.dispatchEvent(new Event("input", { bubbles: true }));
      targetEl.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (targetEl.isContentEditable) {
      targetEl.textContent = text;
      targetEl.dispatchEvent(new Event("input", { bubbles: true }));
    }

    return { success: true };
  }
};
