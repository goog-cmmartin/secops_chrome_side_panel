/**
 * Authentication Service for Gemini & Vertex AI
 * Supports BYOK (Gemini API Key) and Google Cloud Vertex AI OAuth
 */

const DEFAULT_SETTINGS = {
  authMode: "apiKey", // 'apiKey' or 'vertexOAuth'
  apiKey: "",
  model: "gemini-3.8-flash",
  gcpProject: "",
  gcpRegion: "global",
  oauthClientId: "",
  enableMcp: true,
  secopsCustomerId: "",
  secopsRegion: "us",
  enableSecOpsMcp: true
};

window.SecOpsAuthService = {
  /**
   * Load saved extension settings
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
        const localConfig = (typeof window !== "undefined" && window.__SECOPS_LOCAL_CONFIG__) || {};
        const result = { ...items };
        // Seed default fields from optional config.local.js if storage is unpopulated
        for (const [key, val] of Object.entries(localConfig)) {
          if (val && !result[key]) {
            result[key] = val;
          }
        }
        resolve(result);
      });
    });
  },

  /**
   * Save extension settings
   */
  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set(settings, () => {
        resolve();
      });
    });
  },

  /**
   * Acquire OAuth token for Google Cloud Vertex AI via chrome.identity
   */
  async getVertexAuthToken(interactive = true) {
    return new Promise((resolve, reject) => {
      if (!chrome.identity || !chrome.identity.getAuthToken) {
        return reject(
          new Error("chrome.identity API is not available or OAuth not configured in manifest.")
        );
      }

      chrome.identity.getAuthToken({ interactive: interactive }, (token) => {
        if (chrome.runtime.lastError) {
          return reject(new Error(chrome.runtime.lastError.message));
        }
        if (!token) {
          return reject(new Error("Failed to obtain OAuth token from Google."));
        }
        resolve(token);
      });
    });
  },

  /**
   * Invalidate cached OAuth token if a 401 Unauthorized is encountered
   */
  async clearAuthToken(token) {
    return new Promise((resolve) => {
      if (chrome.identity && chrome.identity.removeCachedAuthToken) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
};
