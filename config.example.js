/**
 * Optional Local Developer Configuration Template
 * 
 * To pre-populate your development settings without typing them into the
 * Extension Settings UI each time, copy this file to `config.local.js`:
 * 
 *   cp config.example.js config.local.js
 * 
 * Note: `config.local.js` is ignored by Git and will never be committed.
 */
window.__SECOPS_LOCAL_CONFIG__ = {
  // Google Cloud Project ID for Vertex AI OAuth & SecOps MCP
  gcpProject: "", // e.g. "my-soc-project-id"

  // Google Cloud region (default: "global")
  gcpRegion: "global",

  // Google SecOps Customer ID (UUID format)
  secopsCustomerId: "", // e.g. "00000000-0000-0000-0000-000000000000"

  // Google SecOps API region ("us", "europe", "asia-southeast1", etc.)
  secopsRegion: "us",

  // OAuth 2.0 Client ID for Google Cloud Vertex AI
  oauthClientId: "", // e.g. "123456789-abcdef.apps.googleusercontent.com"

  // Enable Google Cloud Logging Remote MCP Server (default: true)
  enableLoggingMcp: true
};
