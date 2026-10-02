/**
 * Google SecOps Assistant & Troubleshooter - Background Service Worker
 * Manages side panel behavior, SPA route change detection, and tab sync.
 */

// Configure side panel to open on action icon click
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn("Failed to set side panel behavior:", error));

// Target domain filters for Google SecOps and Documentation
const TARGET_URL_FILTERS = [
  { hostSuffix: "chronicle.security" },
  { hostSuffix: "secops.google.com" },
  { hostContains: "docs.cloud.google.com" },
  { hostContains: "cloud.google.com" }
];

/**
 * Broadcast event to runtime listeners (e.g. side panel)
 */
function broadcastMessage(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {
    // Expected error if side panel is not currently open
  });
}

/**
 * 1. SPA Navigation Detection:
 * Fires on HTML5 History API updates (pushState/replaceState) in SecOps SPA
 */
chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId === 0) {
      broadcastMessage({
        type: "PAGE_NAVIGATED",
        tabId: details.tabId,
        url: details.url,
        transitionType: details.transitionType
      });
    }
  },
  { url: TARGET_URL_FILTERS }
);

/**
 * 2. Active Tab Switch Detection:
 * Fires when user switches tabs between SecOps, Documentation, or other pages
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    broadcastMessage({
      type: "TAB_SWITCHED",
      tabId: tab.id,
      url: tab.url,
      title: tab.title
    });
  });
});

/**
 * 3. Page Reload / Load Completion:
 * Catches full reloads or external deep links
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const isTarget = TARGET_URL_FILTERS.some((filter) => {
      if (filter.hostSuffix && tab.url.includes(filter.hostSuffix)) return true;
      if (filter.hostContains && tab.url.includes(filter.hostContains)) return true;
      return false;
    });

    if (isTarget) {
      broadcastMessage({
        type: "PAGE_LOAD_COMPLETE",
        tabId: tabId,
        url: tab.url,
        title: tab.title
      });
    }
  }
});

/**
 * 4. Runtime message handling from Side Panel UI and Content Scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_ACTIVE_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        sendResponse({ tab: tabs[0] });
      } else {
        sendResponse({ tab: null });
      }
    });
    return true; // Keep channel open for async response
  }

  // Handle AI Pointer Action from SecOps DOM
  if (request.type === "AI_POINTER_ACTION") {
    const tabId = sender.tab ? sender.tab.id : null;
    const windowId = sender.tab ? sender.tab.windowId : null;

    // Open side panel if available
    if (tabId && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tabId }).catch(() => {
        if (windowId) {
          chrome.sidePanel.open({ windowId: windowId }).catch(() => {});
        }
      });
    }

    // Capture tab screenshot
    chrome.tabs.captureVisibleTab(windowId, { format: "png" }, (dataUrl) => {
      const err = chrome.runtime.lastError;
      const screenshot = (!err && dataUrl) ? dataUrl : null;

      broadcastMessage({
        type: "AI_POINTER_TRIGGERED",
        action: request.action,
        elementInfo: request.elementInfo,
        bounds: request.bounds,
        screenshotUrl: screenshot,
        pageUrl: request.pageUrl,
        pageTitle: request.pageTitle,
        tabId: tabId
      });
    });

    sendResponse({ status: "processing" });
    return true;
  }
});

