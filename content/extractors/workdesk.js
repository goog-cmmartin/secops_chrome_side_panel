/**
 * Workdesk Extractor
 * Extracts context from /your-workdesk/* sub-routes:
 * /your-workdesk/cases
 * /your-workdesk/pending-actions
 * /your-workdesk/tasks
 * /your-workdesk/requests
 * /your-workdesk/workspace
 * /your-workdesk/announcements
 */
window.SecOpsWorkdeskExtractor = {
  matches(url) {
    return url.includes("/your-workdesk");
  },

  extract() {
    const url = window.location.href;
    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    // 1. Identify sub-route (e.g. /your-workdesk/cases, /your-workdesk/pending-actions)
    let subTab = "cases";
    const match = url.match(/\/your-workdesk\/([a-zA-Z0-9_\-]+)/i);
    if (match && match[1]) {
      subTab = match[1].toLowerCase();
    }

    const subTabTitles = {
      "cases": "Cases",
      "pending-actions": "Pending Actions",
      "tasks": "Tasks",
      "requests": "Requests",
      "workspace": "Workspace",
      "announcements": "Announcements"
    };

    const subTabTitle = subTabTitles[subTab] || (subTab.charAt(0).toUpperCase() + subTab.slice(1).replace(/[-_]+/g, " "));
    const feature = `Workdesk • ${subTabTitle}`;

    // 2. Extract visible queue items / table rows / cards
    const visibleItems = [];
    document.querySelectorAll("table tbody tr, .card, [role='row'], .workdesk-item").forEach((row) => {
      const text = row.innerText.replace(/\s+/g, " ").trim();
      if (text && text.length > 5 && visibleItems.length < 15) {
        visibleItems.push(window.SecOpsDOMUtils.truncate(text, 180));
      }
    });

    // 3. Extract visible counter badges (e.g. pending action counts, open task counts)
    const counters = [];
    document.querySelectorAll(".badge, .counter, [data-testid*='count'], .tab-count").forEach((badge) => {
      const count = badge.textContent.trim();
      if (count && /^\d+$/.test(count)) {
        counters.push(count);
      }
    });

    const mainEl = document.querySelector("main, [role='main'], #main-content, .workdesk-container");
    const summary = mainEl ? window.SecOpsDOMUtils.truncate(mainEl.innerText.replace(/\s+/g, " ").trim(), 1500) : null;

    return {
      feature: feature,
      route: "workdesk",
      subTab: subTab,
      subTabTitle: subTabTitle,
      itemsCount: visibleItems.length,
      visibleItems: visibleItems.length > 0 ? visibleItems : null,
      counters: counters.length > 0 ? counters : null,
      detectedErrors: errors.length > 0 ? errors : null,
      summary: summary
    };
  }
};
