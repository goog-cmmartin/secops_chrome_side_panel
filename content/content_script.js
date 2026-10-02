/**
 * Main Content Script Coordinator
 * Listens for extraction commands from the Side Panel and compiles the context payload.
 */

function gatherCurrentContext() {
  const currentUrl = window.location.href;
  const pageTitle = document.title;
  const userSelection = window.SecOpsDOMUtils.extractSelection();

  let featureContext = null;

  if (window.SecOpsWorkdeskExtractor && window.SecOpsWorkdeskExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsWorkdeskExtractor.extract();
  } else if (window.SecOpsSOARSearchExtractor && window.SecOpsSOARSearchExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsSOARSearchExtractor.extract();
  } else if (window.SecOpsDataTablesExtractor && window.SecOpsDataTablesExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsDataTablesExtractor.extract();
  } else if (window.SecOpsThreatsExtractor && window.SecOpsThreatsExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsThreatsExtractor.extract();
  } else if (window.SecOpsUDMExtractor && window.SecOpsUDMExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsUDMExtractor.extract();
  } else if (window.SecOpsRulesExtractor && window.SecOpsRulesExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsRulesExtractor.extract();
  } else if (window.SecOpsCaseExtractor && window.SecOpsCaseExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsCaseExtractor.extract();
  } else if (window.SecOpsDocsExtractor && window.SecOpsDocsExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsDocsExtractor.extract();
  } else if (window.SecOpsSettingsExtractor && window.SecOpsSettingsExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsSettingsExtractor.extract();
  } else if (window.SecOpsBreachAnalyticsExtractor && window.SecOpsBreachAnalyticsExtractor.matches(currentUrl)) {
    featureContext = window.SecOpsBreachAnalyticsExtractor.extract();
  } else {
    // Fallback: general view
    const mainEl = document.querySelector("main, [role='main'], #main-content");
    const errors = window.SecOpsDOMUtils.extractErrorBanners();
    featureContext = {
      feature: "Google SecOps Console",
      pageTitle: pageTitle,
      detectedErrors: errors.length > 0 ? errors : null,
      summary: mainEl ? window.SecOpsDOMUtils.truncate(mainEl.innerText.replace(/\s+/g, " ").trim(), 2000) : null
    };
  }

  return {
    url: currentUrl,
    title: pageTitle,
    userSelection: userSelection,
    featureContext: featureContext,
    timestamp: new Date().toISOString()
  };
}

// Listen for messages from background or side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "EXTRACT_PAGE_CONTEXT") {
    try {
      const contextData = gatherCurrentContext();
      sendResponse({ success: true, data: contextData });
    } catch (err) {
      console.error("[SecOps Assistant] Extraction error:", err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (request.type === "INJECT_TEXT_INTO_PAGE") {
    try {
      const result = window.SecOpsDOMUtils.insertTextIntoActiveInput(request.text);
      sendResponse(result);
    } catch (err) {
      console.error("[SecOps Assistant] Injection error:", err);
      sendResponse({ success: false, reason: err.message });
    }
    return true;
  }
});
