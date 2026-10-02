/**
 * UDM Search Extractor
 */
window.SecOpsUDMExtractor = {
  matches(url) {
    return (
      url.includes("/search") ||
      url.includes("/udm-search") ||
      url.includes("view=udm") ||
      url.includes("/raw-search")
    );
  },

  extract() {
    const query = window.SecOpsDOMUtils.extractCodeEditorContent();
    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    // Extract time range selector if visible
    let timeRange = null;
    const timeEl = document.querySelector(
      "[data-testid='time-range-picker'], .time-range-selector, .date-range-picker button"
    );
    if (timeEl && timeEl.textContent) {
      timeRange = timeEl.textContent.trim();
    }

    return {
      feature: "UDM Search",
      query: query || "No query currently entered in editor",
      timeRange: timeRange,
      detectedErrors: errors.length > 0 ? errors : null
    };
  }
};
