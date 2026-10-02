/**
 * SOAR Search Extractor
 * Extracts context from /sp-search (SOAR global search for cases, alerts, entities, playbooks)
 */
window.SecOpsSOARSearchExtractor = {
  matches(url) {
    return url.includes("/sp-search");
  },

  extract() {
    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    // 1. Extract search input query
    let query = null;
    const inputEl = document.querySelector(
      "input[type='search'], input[placeholder*='Search'], input[data-testid='search-input'], .search-box input"
    );
    if (inputEl && inputEl.value) {
      query = inputEl.value.trim();
    }

    // 2. Extract active filter tab (e.g. All, Cases, Alerts, Entities, Playbooks)
    let activeFilter = "All";
    const activeTabEl = document.querySelector(
      ".tab.active, [role='tab'][aria-selected='true'], .filter-pill.active"
    );
    if (activeTabEl && activeTabEl.textContent) {
      activeFilter = activeTabEl.textContent.trim();
    }

    // 3. Extract search result rows / cards
    const results = [];
    document.querySelectorAll(".search-result, table tbody tr, .result-card, [role='row']").forEach((row) => {
      const text = row.innerText.replace(/\s+/g, " ").trim();
      if (text && text.length > 5 && results.length < 10) {
        results.push(window.SecOpsDOMUtils.truncate(text, 160));
      }
    });

    const mainEl = document.querySelector("main, [role='main'], #main-content, .sp-search-container");
    const summary = mainEl ? window.SecOpsDOMUtils.truncate(mainEl.innerText.replace(/\s+/g, " ").trim(), 1500) : null;

    return {
      feature: "SOAR Search",
      route: "soar-search",
      query: query || "No query currently entered",
      activeFilter: activeFilter,
      resultsCount: results.length,
      results: results.length > 0 ? results : null,
      detectedErrors: errors.length > 0 ? errors : null,
      summary: summary
    };
  }
};
