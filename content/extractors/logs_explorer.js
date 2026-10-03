/**
 * Google Cloud Logging Explorer Extractor
 * Extracts active filter query, time window, and project context from Google Cloud Logs Explorer.
 */
window.SecOpsLogsExplorerExtractor = {
  matches(url) {
    return (
      url.includes("console.cloud.google.com/logs") ||
      url.includes("docs.cloud.google.com/logging")
    );
  },

  extract() {
    let query = "";
    let projectId = "";

    // Extract project from URL search parameters if available
    try {
      const urlObj = new URL(window.location.href);
      projectId = urlObj.searchParams.get("project") || "";
      query = urlObj.searchParams.get("query") || "";
    } catch (_) {}

    // Extract query from Cloud Console monaco / query editor if available in DOM
    if (!query) {
      const editorEl = document.querySelector(
        ".logs-query-editor, [data-testid='query-editor'], textarea[aria-label*='query'], .view-lines"
      );
      if (editorEl && editorEl.textContent) {
        query = editorEl.textContent.trim();
      }
    }

    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    return {
      feature: "Cloud Logging Explorer",
      query: query || "No query currently entered in Logs Explorer",
      projectId: projectId || null,
      detectedErrors: errors.length > 0 ? errors : null
    };
  }
};
