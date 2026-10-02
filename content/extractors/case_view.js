/**
 * Case & Alert Investigation Extractor
 * Supports deep route inspection for /cases/{caseId}/{subTab} (e.g. wall, alerts, playbook, overview)
 */
window.SecOpsCaseExtractor = {
  matches(url) {
    if (url.includes("/your-workdesk")) return false;
    return (
      url.includes("/cases") ||
      url.includes("/alerts") ||
      url.includes("/investigation")
    );
  },

  extract() {
    const url = window.location.href;

    // 1. Parse Case ID and Sub-Tab from URL (e.g. /cases/106565/wall)
    let caseId = null;
    let subTab = "overview";

    const caseMatch = url.match(/\/cases\/([a-zA-Z0-9_\-]+)(?:\/([a-zA-Z0-9_\-]+))?/i);
    if (caseMatch) {
      caseId = caseMatch[1];
      if (caseMatch[2]) {
        subTab = caseMatch[2].toLowerCase();
      }
    }

    // Friendly sub-tab display name
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
    const featureName = caseId ? `Case #${caseId} • ${tabDisplay}` : "Alert & Case Investigation";

    // 2. Extract Header Metadata
    const titleEl = document.querySelector(
      "h1.case-title, [data-testid='case-title'], .case-header-title, h1, .header-title, .alert-title"
    );
    const caseTitle = titleEl ? titleEl.textContent.trim() : document.title;

    let severity = null;
    const severityBadge = document.querySelector(".severity-badge, [data-testid='severity'], .priority-tag, [class*='severity']");
    if (severityBadge) severity = severityBadge.textContent.trim();

    let status = null;
    const statusBadge = document.querySelector(".status-badge, [data-testid='status'], .state-tag, [class*='status']");
    if (statusBadge) status = statusBadge.textContent.trim();

    let priority = null;
    const priorityBadge = document.querySelector(".priority-badge, [data-testid='priority'], [class*='priority']");
    if (priorityBadge) priority = priorityBadge.textContent.trim();

    let assignee = null;
    const assigneeEl = document.querySelector(".assignee, [data-testid='assignee'], [class*='assignee']");
    if (assigneeEl) assignee = assigneeEl.textContent.trim();

    // 3. Extract Involved Entities
    const entities = [];
    document.querySelectorAll(".entity-chip, [data-testid='entity-name'], .entity-row, [class*='entity-chip']").forEach((el) => {
      const text = el.textContent.trim();
      if (text && !entities.includes(text) && entities.length < 20) {
        entities.push(text);
      }
    });

    // 4. Sub-Tab Specific Extractions (Wall Activity, Comments, Playbook Logs)
    let wallActivity = [];
    if (subTab === "wall") {
      const wallItems = document.querySelectorAll(
        ".wall-item, .wall-comment, .activity-card, .comment-row, [data-testid*='wall'], [data-testid*='comment'], [class*='wall-item'], [class*='activity-item'], [class*='timeline-item']"
      );

      wallItems.forEach((item) => {
        if (wallActivity.length >= 15) return;

        const authorEl = item.querySelector(".comment-author, .author, [class*='author'], .user-name");
        const timeEl = item.querySelector(".timestamp, time, [class*='timestamp'], [class*='time']");
        const bodyEl = item.querySelector(".comment-body, .message, .content, [class*='content'], [class*='text']") || item;

        const author = authorEl ? authorEl.textContent.trim() : "System / Playbook";
        const time = timeEl ? timeEl.textContent.trim() : "";
        let body = bodyEl ? bodyEl.textContent.replace(/\s+/g, " ").trim() : "";

        // Truncate overly long body entries
        if (body.length > 250) {
          body = body.slice(0, 250) + "...";
        }

        if (body) {
          wallActivity.push({
            author: author,
            timestamp: time,
            content: body
          });
        }
      });

      // Fallback: If no distinct wall items found, inspect primary container text
      if (wallActivity.length === 0) {
        const wallContainer = document.querySelector("[role='feed'], .wall-container, #wall, [class*='wall']");
        if (wallContainer) {
          const rawText = wallContainer.innerText.replace(/\s+/g, " ").trim();
          if (rawText) {
            wallActivity.push({
              author: "Wall Feed",
              timestamp: "",
              content: rawText.slice(0, 1000)
            });
          }
        }
      }
    }

    const errors = window.SecOpsDOMUtils.extractErrorBanners();

    return {
      feature: featureName,
      caseId: caseId,
      subTab: subTab,
      caseTitle: caseTitle,
      severity: severity,
      status: status,
      priority: priority,
      assignee: assignee,
      involvedEntities: entities.length > 0 ? entities : null,
      wallActivity: wallActivity.length > 0 ? wallActivity : null,
      detectedErrors: errors.length > 0 ? errors : null
    };
  }
};
