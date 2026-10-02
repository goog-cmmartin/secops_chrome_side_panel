# Google SecOps Assistant & Troubleshooter (Chrome Side Panel)

An AI-powered Chrome Side Panel extension designed to guide, train, and troubleshoot analysts using **Google SecOps** (`backstory.chronicle.security`, `*.secops.google.com`) and referencing **Chronicle Documentation** (`docs.cloud.google.com/chronicle/docs`).

---

## Key Features

1. **Native Chrome Side Panel (Manifest V3)**:
   - Lives alongside your Google SecOps console and documentation tabs without obscuring your workspace.
2. **SPA Active Page & Route Detection**:
   - Uses `chrome.webNavigation.onHistoryStateUpdated` to instantly track Single Page Application (SPA) client-side routing (`pushState` / `replaceState`) as you navigate between UDM Search, YARA-L Rules, Alerts, and Cases.
3. **High-Signal Context Extractor**:
   - **UDM Search**: Extracts active query text, time range filter, and search errors.
   - **YARA-L Rules**: Captures rule editor syntax, rule name, and compiler/linter error callouts.
   - **Alerts & Cases**: Captures case title, priority, status, and involved entities (IPs, users, hostnames).
   - **Chronicle Docs**: Extracts article title, breadcrumbs, and documentation body text without noisy navigation sidebars.
   - **Error Sniffer**: Automatically detects on-screen error banners, warning toasts, and syntax flags to pinpoint troubleshooting needs.
   - **User Selection**: Seamlessly captures highlighted text or log entries for immediate contextual explanation.
4. **Interactive Streaming Chat**:
   - Streams responses token-by-token with code syntax highlighting and one-click copy buttons.
5. **Flexible Authentication**:
   - **Mode A: Gemini API Key (BYOK)**: Instant setup using your individual key from Google AI Studio, securely saved in browser local storage.
   - **Mode B: Google Cloud Vertex AI (OAuth)**: Enterprise integration using Google OAuth targeting project `sdl-preview-americas`.

---

## Installation & Setup

### Step 1: Load the Unpacked Extension in Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left corner.
4. Select the directory:
   ```
   <repo-root>/clients/chrome_extension/
   ```
5. Pin the **Google SecOps Assistant** extension to your Chrome toolbar.

---

## Authentication Configuration

Click the extension icon or open the Side Panel, then click the **Settings gear (⚙️)** in the top right.

### Option A: Gemini API Key (Recommended for Quick Start)
1. Select **Gemini API Key (BYOK)**.
2. Enter your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Select your preferred model (`gemini-3.8-flash` or `gemini-3.8-pro`).
4. Click **Save Settings**.

### Option B: Google Cloud Vertex AI OAuth (`sdl-preview-americas`)
1. In Google Cloud Console for project `sdl-preview-americas`:
   - Go to **APIs & Services → Credentials**.
   - Click **Create Credentials → OAuth client ID**.
   - Select **Chrome extension** as the application type.
   - Enter your Extension ID (copy from `chrome://extensions/` under "Google SecOps Assistant").
2. Update `manifest.json` with the generated Client ID:
   ```json
   "oauth2": {
     "client_id": "<GENERATED_CLIENT_ID>.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/cloud-platform"]
   }
   ```
3. In the extension Settings modal, select **Google Cloud Vertex AI (OAuth)**:
   - Project ID: `sdl-preview-americas`
   - Region: `us-central1`
4. Click **Save Settings**. Chrome will prompt for Google Account sign-in via `chrome.identity`.

---

## Usage Walkthrough

### 1. Opening the Assistant
- While on `https://backstory.chronicle.security` or `https://docs.cloud.google.com/chronicle/docs`, click the extension icon or open Chrome's Side Panel dropdown and choose **SecOps Assistant**.
- The top badge will automatically indicate your active screen (e.g. `[UDM Search]` or `[YARA-L Rules Editor]`).

### 2. Troubleshooting Errors
- If a query fails or a YARA-L rule shows compilation errors, the red **Error badge** illuminates.
- Click the quick action **"⚠️ Troubleshoot error"**. The assistant reads the extracted compiler error and provides a corrected syntax snippet.

### 3. Explaining & Optimizing Queries
- Enter a query into SecOps or highlight a section of a log.
- Click **"🔍 Explain / fix UDM query"** or ask: *"How can I filter for successful authentication from external IPs?"*

### 4. Grounding with Chronicle Documentation
- Open any article under `https://docs.cloud.google.com/chronicle/docs`.
- The assistant synchronizes with the documentation context, allowing you to ask questions directly grounded in the article content.
