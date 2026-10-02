/**
 * Chronicle / Google SecOps Breach Analytics Extractor
 * Extracts context from /breach-analytics views (Mandiant Breach Analytics, IOC matches, threat actor attribution)
 */
window.SecOpsBreachAnalyticsExtractor = {
  matches(url) {
    return url.includes("/breach-analytics");
  },

  extract() {
    // 1. Time range from URL search params
    let startTime = null;
    let endTime = null;
    try {
      const urlObj = new URL(window.location.href);
      startTime = urlObj.searchParams.get("startTime");
      endTime = urlObj.searchParams.get("endTime");
    } catch (_) {}

    // 2. On-screen time picker fallback if available
    const timePickerEl = document.querySelector(".time-picker, [data-testid='time-range'], .date-range-picker");
    const displayTimeRange = timePickerEl ? timePickerEl.textContent.trim().replace(/\s+/g, " ") : null;

    // 3. Extract Breach Analytics cards / table entries
    const detections = [];
    const rows = document.querySelectorAll(
      ".breach-analytics-row, [role='row'], .detection-card, .ioc-match-row, tbody tr"
    );

    rows.forEach((row, idx) => {
      if (idx > 25) return; // Cap at 25 items
      const text = row.innerText.replace(/\s+/g, " ").trim();
      if (text && text.length > 10) {
        // Attempt to find severity / confidence badges
        const severityEl = row.querySelector(".severity, .confidence, .badge, [class*='severity'], [class*='confidence']");
        const severity = severityEl ? severityEl.textContent.trim() : null;
        detections.push(severity ? `[${severity}] ${text}` : text);
      }
    });

    // 4. Detected On-Screen Errors or Banners
    const errors = window.SecOpsDOMUtils ? window.SecOpsDOMUtils.extractErrorBanners() : [];

    // 5. Main Content Summary fallback
    const mainEl = document.querySelector("main, [role='main'], #main-content");
    const summary = mainEl && window.SecOpsDOMUtils ? window.SecOpsDOMUtils.truncate(mainEl.innerText.replace(/\s+/g, " ").trim(), 2000) : null;

    let timeWindowStr = null;
    if (startTime && endTime) {
      timeWindowStr = `${startTime} to ${endTime}`;
    } else if (displayTimeRange) {
      timeWindowStr = displayTimeRange;
    }

    return {
      feature: "Breach Analytics",
      route: "breach-analytics",
      startTime: startTime,
      endTime: endTime,
      timeWindow: timeWindowStr,
      detectionsCount: detections.length,
      detections: detections.length > 0 ? detections.slice(0, 15) : null,
      detectedErrors: errors.length > 0 ? errors : null,
      summary: summary
    };
  }
};
