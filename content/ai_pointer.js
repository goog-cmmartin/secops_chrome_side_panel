/**
 * Google SecOps Assistant - AI Pointer
 * Reimagines the mouse pointer into a context-aware AI partner inspired by
 * Google DeepMind's Magic Pointer research.
 *
 * Exclusively active on Google SecOps domains.
 */

(function () {
  if (window.__secopsAiPointerInjected) return;
  window.__secopsAiPointerInjected = true;

  // Only run in top-level window
  if (window.top !== window) return;

  let isEnabled = true;
  let shadowHost = null;
  let shadowRoot = null;
  let activeTarget = null;
  let hudVisible = false;

  // Wiggle detection state
  const WIGGLE_WINDOW_MS = 350;
  const WIGGLE_REVERSAL_THRESHOLD = 3;
  const MIN_DISPLACEMENT = 15;
  const history = []; // [{ x, y, t, dx }]

  // Load user preference
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get({ aiPointerEnabled: true }, (res) => {
      isEnabled = res.aiPointerEnabled !== false;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.aiPointerEnabled) {
        isEnabled = changes.aiPointerEnabled.newValue !== false;
        if (!isEnabled) hideHud();
      }
    });
  }

  /**
   * Initialize Shadow DOM Container for style isolation
   */
  function ensureShadowRoot() {
    if (shadowRoot) return shadowRoot;

    shadowHost = document.createElement("div");
    shadowHost.id = "secops-ai-pointer-host";
    shadowHost.style.position = "fixed";
    shadowHost.style.top = "0";
    shadowHost.style.left = "0";
    shadowHost.style.width = "0";
    shadowHost.style.height = "0";
    shadowHost.style.zIndex = "2147483647";
    shadowHost.style.pointerEvents = "none";

    shadowRoot = shadowHost.attachShadow({ mode: "open" });

    // Inject styles directly inside shadow root
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        color: #e8eaed;
        z-index: 2147483647;
      }
      .ai-pointer-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 2147483647;
      }
      .ai-pointer-hud {
        position: absolute;
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 270px;
        max-width: 350px;
        background: rgba(32, 33, 36, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(138, 180, 248, 0.45);
        border-radius: 12px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(138, 180, 248, 0.25);
        padding: 11px 13px;
        user-select: none;
        animation: hudIn 0.16s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes hudIn {
        from { opacity: 0; transform: scale(0.94) translateY(4px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .hud-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 6px;
      }
      .hud-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(138, 180, 248, 0.15);
        color: #8ab4f8;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(138, 180, 248, 0.35);
      }
      .hud-close-btn {
        background: transparent;
        border: none;
        color: #9aa0a6;
        cursor: pointer;
        padding: 2px 6px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.15s ease;
      }
      .hud-close-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        color: #e8eaed;
      }
      .hud-target-preview {
        font-size: 12px;
        color: #dadce0;
        max-height: 52px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        background: rgba(0, 0, 0, 0.3);
        padding: 6px 9px;
        border-radius: 6px;
        border-left: 3px solid #8ab4f8;
        word-break: break-word;
      }
      .hud-actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 6px;
        margin-top: 2px;
      }
      .hud-action-btn {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        box-sizing: border-box;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 7px;
        padding: 8px 10px;
        color: #e8eaed;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        text-align: left;
        transition: all 0.15s ease;
      }
      .hud-action-btn:hover {
        background: rgba(138, 180, 248, 0.22);
        border-color: rgba(138, 180, 248, 0.55);
        color: #ffffff;
        transform: translateY(-1px);
      }
      .hud-action-btn:active {
        transform: translateY(0);
      }
      .hud-action-btn.primary {
        background: linear-gradient(135deg, rgba(66, 133, 244, 0.28), rgba(52, 168, 83, 0.22));
        border-color: rgba(138, 180, 248, 0.45);
      }
      .hud-action-btn.primary:hover {
        background: linear-gradient(135deg, rgba(66, 133, 244, 0.42), rgba(52, 168, 83, 0.35));
        border-color: #8ab4f8;
      }
      .hud-action-icon {
        font-size: 14px;
        flex-shrink: 0;
      }
      .hud-action-text {
        flex-grow: 1;
      }
      .hud-action-meta {
        font-size: 10px;
        color: #9aa0a6;
        display: block;
        font-weight: 400;
        margin-top: 1px;
      }
      .ai-pointer-highlight {
        position: absolute;
        pointer-events: none;
        border: 2px dashed rgba(138, 180, 248, 0.85);
        border-radius: 5px;
        background: rgba(138, 180, 248, 0.12);
        transition: all 0.12s ease-out;
      }
    `;
    shadowRoot.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "ai-pointer-overlay";
    overlay.id = "overlay";
    shadowRoot.appendChild(overlay);

    document.documentElement.appendChild(shadowHost);
    return shadowRoot;
  }

  /**
   * Crawls up the DOM to find the most meaningful semantic SecOps container
   */
  function findSemanticTarget(rawEl) {
    if (!rawEl || rawEl === document.body || rawEl === document.documentElement) {
      return null;
    }

    // Don't target our own shadow host
    if (rawEl.id === "secops-ai-pointer-host" || rawEl.closest("#secops-ai-pointer-host")) {
      return null;
    }

    let el = rawEl;
    let fallback = rawEl;

    while (el && el !== document.body && el !== document.documentElement) {
      // 1. Data Tables & Grids
      if (el.matches('tr, [role="row"], .data-table-row, .mat-row')) return el;

      // 2. Cards & Rule Rows
      if (el.matches('.card, .rule-row, .threat-item, .alert-row, .case-card, [data-testid]')) return el;

      // 3. Code Editor / Monaco lines
      if (el.matches('.view-line, .monaco-editor, code, pre')) return el;

      // 4. Charts, Histograms & Visualizations
      if (el.matches('svg, canvas, .chart-container, .histogram-bar')) return el;

      // 5. Buttons, Badges & Inputs with meaningful text
      if (el.matches('button, a, input, select, .badge, .status-pill, [role="button"]')) return el;

      el = el.parentElement;
    }

    return fallback;
  }

  /**
   * Extract semantic details from element
   */
  function extractElementInfo(el) {
    if (!el) return null;

    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role") || "";
    const aria = el.getAttribute("aria-label") || el.getAttribute("title") || "";
    
    // Clean text snippet
    let text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
    if (!text && aria) text = aria;
    if (!text && el.placeholder) text = el.placeholder;
    if (!text) text = `<${tag}> element`;

    const cleanSnippet = text.length > 180 ? text.slice(0, 180) + "..." : text;

    return {
      tag: tag,
      role: role,
      aria: aria,
      text: cleanSnippet,
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        dpr: window.devicePixelRatio || 1
      }
    };
  }

  /**
   * Render Floating HUD
   */
  function showHud(clientX, clientY, targetEl) {
    if (!isEnabled || !targetEl) return;

    ensureShadowRoot();
    const overlay = shadowRoot.getElementById("overlay");
    if (!overlay) return;

    const info = extractElementInfo(targetEl);
    if (!info) return;

    activeTarget = { el: targetEl, info: info };
    hudVisible = true;
    overlay.innerHTML = "";

    // 1. Target bounding highlight
    const highlight = document.createElement("div");
    highlight.className = "ai-pointer-highlight";
    highlight.style.left = `${info.rect.left}px`;
    highlight.style.top = `${info.rect.top}px`;
    highlight.style.width = `${Math.max(info.rect.width, 24)}px`;
    highlight.style.height = `${Math.max(info.rect.height, 24)}px`;
    overlay.appendChild(highlight);

    // 2. Floating HUD
    const hud = document.createElement("div");
    hud.className = "ai-pointer-hud";

    // Viewport clamping
    const hudWidth = 290;
    const hudHeight = 210;
    let posX = clientX + 16;
    let posY = clientY + 16;

    if (posX + hudWidth > window.innerWidth) {
      posX = Math.max(12, clientX - hudWidth - 16);
    }
    if (posY + hudHeight > window.innerHeight) {
      posY = Math.max(12, clientY - hudHeight - 16);
    }

    hud.style.left = `${posX}px`;
    hud.style.top = `${posY}px`;

    // Semantic tag display
    const tagDisplay = info.role ? `${info.tag} [${info.role}]` : info.tag;

    hud.innerHTML = `
      <div class="hud-header">
        <span class="hud-pill">
          <svg class="hud-pill-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px; vertical-align: middle; margin-right: 4px;">
            <path d="M12 2l2.4 7.2L21.6 12l-7.2 2.4L12 21.6l-2.4-7.2L2.4 12l7.2-2.4z"/>
          </svg>
          AI Pointer • ${tagDisplay}
        </span>
        <button class="hud-close-btn" id="hudClose" title="Dismiss (Esc)">&times;</button>
      </div>
      <div class="hud-target-preview" title="${info.text}">${info.text}</div>
      <div class="hud-actions">
        <button class="hud-action-btn primary" id="btnDocs">
          <span class="hud-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
          </span>
          <span class="hud-action-text">
            Ask Documentation
            <span class="hud-action-meta">Developer Knowledge MCP</span>
          </span>
        </button>
        <button class="hud-action-btn" id="btnCapture">
          <span class="hud-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </span>
          <span class="hud-action-text">
            Capture Widget & Chat
            <span class="hud-action-meta">Gemini Vision crop to sidepanel</span>
          </span>
        </button>
        <button class="hud-action-btn" id="btnMcp">
          <span class="hud-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 15px; height: 15px;">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </span>
          <span class="hud-action-text">
            Investigate with MCP
            <span class="hud-action-meta">Live SecOps telemetry query</span>
          </span>
        </button>
      </div>
    `;

    overlay.appendChild(hud);

    // Event listeners
    hud.querySelector("#hudClose").addEventListener("click", (e) => {
      e.stopPropagation();
      hideHud();
    });

    hud.querySelector("#btnDocs").addEventListener("click", (e) => {
      e.stopPropagation();
      dispatchAction("docs", info);
    });

    hud.querySelector("#btnCapture").addEventListener("click", (e) => {
      e.stopPropagation();
      dispatchAction("capture", info);
    });

    hud.querySelector("#btnMcp").addEventListener("click", (e) => {
      e.stopPropagation();
      dispatchAction("mcp", info);
    });
  }

  function hideHud() {
    if (!shadowRoot) return;
    const overlay = shadowRoot.getElementById("overlay");
    if (overlay) overlay.innerHTML = "";
    hudVisible = false;
    activeTarget = null;
  }

  /**
   * Dispatch action to background / sidepanel
   */
  function dispatchAction(actionType, info) {
    hideHud();
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: "AI_POINTER_ACTION",
        action: actionType,
        elementInfo: info,
        bounds: info.rect,
        pageUrl: window.location.href,
        pageTitle: document.title
      }).catch((err) => {
        console.debug("AI pointer message error:", err);
      });
    }
  }

  /**
   * Mouse Wiggle Algorithm (DeepMind Magic Pointer concept)
   */
  function handleMouseMove(e) {
    if (!isEnabled || hudVisible) return;

    const now = performance.now();
    const x = e.clientX;
    const y = e.clientY;

    // Prune history older than WIGGLE_WINDOW_MS
    while (history.length > 0 && now - history[0].t > WIGGLE_WINDOW_MS) {
      history.shift();
    }

    if (history.length > 0) {
      const prev = history[history.length - 1];
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 3) {
        history.push({ x, y, t: now, dx, dy });
      }
    } else {
      history.push({ x, y, t: now, dx: 0, dy: 0 });
    }

    // Check for directional reversals
    if (history.length >= 4) {
      let xReversals = 0;
      let totalDisplacement = 0;

      for (let i = 2; i < history.length; i++) {
        const dx1 = history[i - 1].dx;
        const dx2 = history[i].dx;
        totalDisplacement += Math.abs(history[i].dx);

        // Sign change with minimum step size
        if (dx1 * dx2 < -16) {
          xReversals++;
        }
      }

      if (xReversals >= WIGGLE_REVERSAL_THRESHOLD && totalDisplacement > MIN_DISPLACEMENT * 3) {
        history.length = 0; // Reset
        const rawEl = document.elementFromPoint(x, y);
        const targetEl = findSemanticTarget(rawEl);
        if (targetEl) {
          showHud(x, y, targetEl);
        }
      }
    }
  }

  /**
   * Alt + Click / Chord Activation
   */
  function handleMouseDown(e) {
    if (hudVisible && shadowHost && !shadowHost.contains(e.target)) {
      hideHud();
      return;
    }

    if (e.altKey && e.button === 0) {
      e.preventDefault();
      e.stopPropagation();
      const rawEl = document.elementFromPoint(e.clientX, e.clientY);
      const targetEl = findSemanticTarget(rawEl);
      if (targetEl) {
        showHud(e.clientX, e.clientY, targetEl);
      }
    }
  }

  /**
   * Escape key dismiss
   */
  function handleKeyDown(e) {
    if (e.key === "Escape" && hudVisible) {
      hideHud();
    }
  }

  // Register Global DOM Listeners
  window.addEventListener("mousemove", handleMouseMove, { passive: true });
  window.addEventListener("mousedown", handleMouseDown, { capture: true });
  window.addEventListener("keydown", handleKeyDown, { passive: true });

  // Expose API for testing
  window.SecOpsAiPointer = {
    showHud,
    hideHud,
    extractElementInfo,
    findSemanticTarget,
    isHudVisible: () => hudVisible
  };
})();
