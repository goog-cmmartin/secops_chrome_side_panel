/**
 * Authentication Service for Gemini & Vertex AI
 * Supports BYOK (Gemini API Key) and Google Cloud Vertex AI OAuth
 */

const DEFAULT_SETTINGS = {
  authMode: "apiKey", // 'apiKey' or 'vertexOAuth'
  apiKey: "",
  model: "gemini-3.8-flash",
  gcpProject: "sdl-preview-americas",
  gcpRegion: "global",
  oauthClientId: "37679061640-cr39buop386u2uph5mf4e0qr82jvkei9.apps.googleusercontent.com",
  enableMcp: true,
  secopsCustomerId: "a556547c-1cff-43ef-a2e4-cf5b12a865df",
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
        resolve(items);
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
