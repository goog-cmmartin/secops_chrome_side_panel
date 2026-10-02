/**
 * Threats & Applied Threat Intelligence Extractor
 * Extracts context from /threats (Mandiant Threat Intel, threat actors, campaigns, IOC indicators)
 */
window.SecOpsThreatsExtractor = {
  matches(url) {
    return url.includes("/threats");
  },

  extract() {
    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    // 1. Extract active sub-tab or view (e.g. Overview, Threat Actors, Campaigns, Indicators)
    let activeTab = "Overview";
    const tabEl = document.querySelector(".tab.active, [role='tab'][aria-selected='true'], .nav-link.active");
    if (tabEl && tabEl.textContent) {
      activeTab = tabEl.textContent.trim();
    }

    // 2. Extract visible threat actor / campaign tags
    const threatActors = [];
    document.querySelectorAll(".actor-badge, .threat-actor, [data-testid*='actor'], .campaign-name").forEach((el) => {
      const actor = el.textContent.trim();
      if (actor && !threatActors.includes(actor) && threatActors.length < 8) {
        threatActors.push(actor);
      }
    });

    // 3. Extract visible IOC / threat item rows
    const visibleItems = [];
    document.querySelectorAll("table tbody tr, .threat-card, [role='row']").forEach((row) => {
      const text = row.innerText.replace(/\s+/g, " ").trim();
      if (text && text.length > 5 && visibleItems.length < 10) {
        visibleItems.push(window.SecOpsDOMUtils.truncate(text, 160));
      }
    });

    const mainEl = document.querySelector("main, [role='main'], #main-content, .threats-container");
    const summary = mainEl ? window.SecOpsDOMUtils.truncate(mainEl.innerText.replace(/\s+/g, " ").trim(), 1500) : null;

    return {
      feature: activeTab !== "Overview" ? `Threats • ${activeTab}` : "Applied Threat Intelligence",
      route: "threats",
      activeTab: activeTab,
      threatActors: threatActors.length > 0 ? threatActors : null,
      itemsCount: visibleItems.length,
      visibleItems: visibleItems.length > 0 ? visibleItems : null,
      detectedErrors: errors.length > 0 ? errors : null,
      summary: summary
    };
  }
};
