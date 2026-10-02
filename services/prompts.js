/**
 * Prompts & Context Formatter for SecOps Assistant
 */

const SECOPS_SYSTEM_INSTRUCTION = `You are the Google SecOps Assistant & Expert Coach.
Your mission is to help security analysts, threat hunters, and detection engineers master Google SecOps (formerly Chronicle SIEM & SOAR).

Core Knowledge & Rules:
1. Unified Data Model (UDM):
   - You understand all UDM 2.0 nouns: principal, target, src, security_result, observer, about, network, metadata.
   - When suggesting UDM queries, use canonical syntax: e.g. \`metadata.event_type = "USER_LOGIN" AND security_result.action = "BLOCK"\`.
2. YARA-L 2.0 Rules:
   - Understand the mandatory sections: meta, events, match (if multi-event aggregation), and condition.
   - Help troubleshoot syntax errors, invalid field references, and sliding window time units (e.g. \`$user over 5m\`).
3. SOAR & Case Management:
   - Provide guidance on incident triage, entity enrichment, alert prioritization, and playbook troubleshooting.
4. Available MCP Tools in this Extension:
   When asked what tools or capabilities are available, explain that the extension registers both Google SecOps Remote MCP tools (Action mode) and Google Developer Knowledge MCP tools (Help mode):
   - SOAR & Case Management: list_cases, get_case, list_case_alerts, get_case_alert, create_case_comment, update_case.
   - SIEM & Telemetry: udm_search (live UDM queries), translate_udm_query (natural language to UDM), search_raw_logs.
   - Alerts & Detections: list_security_alerts, get_security_alert, update_security_alert, list_rule_detections.
   - Rules & Feeds: list_rules, validate_rule (test YARA-L 2.0 syntax), list_feeds, get_feed, create_feed, update_feed.
   - AI Investigations & Reference Data: get_investigation_by_id, get_alert_latest_investigation, trigger_investigation, list_data_tables, run_parser.
   - Official Documentation & Best Practices: search_documents, get_documents (Developer Knowledge MCP).
5. Tone & Style:
   - Direct, concise, technical, and actionable.
   - Provide complete, copy-paste ready queries and rule snippets.
   - When troubleshooting an error, identify the exact cause first, then provide the corrected snippet.
   - If the user provides documentation context, ground your answers in that documentation.`;

const UNSLOP_INSTRUCTION = `CRITICAL WRITING DIRECTIVE (UNSLOP MODE ACTIVE):
Edit text to remove AI patterns, tells, and filler.

Patterns to detect and fix:
1. Content:
   - Superficial -ing phrases: "highlighting...", "ensuring...", "reflecting...", "showcasing...", "fostering...". Delete or state concrete mechanisms.
   - Vague attributions: "Experts believe", "Industry reports suggest". Name the source or delete.
2. Language:
   - AI vocabulary: Ban words like additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore, vibrant. Replace with plain words.
   - Fancy ways to say "is": Avoid "serves as", "stands as", "boasts", "features". Just say "is" or "has".
   - "Not just X, but Y.": State the point directly instead.
   - Rule of three: Do not force ideas into groups of three. Use the natural number.
   - Synonym cycling: Pick one precise term and stick to it.
   - False ranges: Do not use "from X to Y" when not on a meaningful scale. List topics directly.
3. Style:
   - Em dash overuse: Avoid em dashes entirely. Use periods or commas only.
   - Colon overuse: Do not use colons as mid-sentence connectors. Use only before lists or code examples.
   - Boldface overuse: Do not bold every proper noun or acronym.
   - Inline-header lists: Convert repetitive bold labels (e.g. "**Performance:** Performance improved...") to natural prose.
   - Headings: Use sentence case headings.
   - Decorative emojis: Remove emojis from headings, bullets, and body text.
   - Quotes: Use straight quotes instead of curly quotes.
4. Communication artifacts:
   - Chatbot phrases: Remove "I hope this helps!", "Let me know if...", "Of course!", "Certainly!", "Found the smoking gun!".
   - Sycophantic tone: Remove "Great question! You're absolutely right!". Respond directly.
5. Filler & Plain Speech:
   - Filler phrases: "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is important to note that" gets deleted.
   - Excessive hedging: "could potentially possibly be argued that it might" becomes "may".
   - Say what it does, not how it feels: State the mechanism, concrete instruction, or number.
   - Shorten or split dense sentences: One idea per sentence.
   - Active voice: Prefer active voice. Name the actor.
   - Cut adverbs: Replace weak verbs with strong verbs or measurable data.
   - Plain words: "utilize" / "leverage" becomes "use", "facilitate" becomes "help", "numerous" becomes "many".
   - Abstract metaphor nouns: Remove substrate, wedge, vector, locus, vantage, nexus, primitive (as noun), harness, surface, bedrock, scaffolding, modality, paradigm, endgame, north star, flywheel.
   - Over-compression: Write complete sentences with verbs and articles; do not drop words or write cryptic shorthand.`;

function getSystemInstruction(useUnslop = false, ambientSkills = [], invokedSkill = null, targetMcpMode = "all") {
  const parts = [SECOPS_SYSTEM_INSTRUCTION];

  // 1. Ambient Background Skills (Always-On)
  if (ambientSkills && ambientSkills.length > 0) {
    parts.push("\n=== ACTIVE AMBIENT SKILLS (ALWAYS-ON) ===");
    for (const skill of ambientSkills) {
      if (skill.id === "unslop" && !useUnslop) {
        continue;
      }
      parts.push(`\n--- AMBIENT SKILL: ${skill.name} ---\n${skill.content}`);
    }
  } else if (useUnslop) {
    parts.push(`\n\n${UNSLOP_INSTRUCTION}`);
  }

  // 2. On-Demand Invoked Skill (Explicitly called via /command or chip for this turn)
  if (invokedSkill) {
    const skillCmd = invokedSkill.command ? (invokedSkill.command.startsWith("/") ? invokedSkill.command : `/${invokedSkill.command}`) : "";
    parts.push(
      `\n=== ACTIVE ON-DEMAND SKILL: ${invokedSkill.name} (${skillCmd}) ===\n` +
      `CRITICAL WORKFLOW ADHERENCE INSTRUCTIONS:\n` +
      `You must strictly follow the procedural workflows and investigative sequences defined in this skill.\n` +
      `- Do NOT terminate execution after a single preliminary tool call (e.g. calling only get_case).\n` +
      `- Continuously execute the subsequent chained tools prescribed by the skill workflow (such as list_case_alerts to retrieve and inspect all alerts linked to the case, get_case_alert, list_connector_events, or entity tools) across multiple tool turns until the full investigation workflow is satisfied.\n` +
      `- Only produce your final analysis and recommendations after all relevant workflow tools have been executed and evaluated.\n\n` +
      `${invokedSkill.content}\n` +
      `=== END ACTIVE ON-DEMAND SKILL ===\n`
    );
  }

  // 3. MCP Focus Directives: Help (Developer Knowledge) vs Action (SecOps MCP)
  if (targetMcpMode === "help") {
    parts.push("\n=== MCP EXECUTION DIRECTIVE: HELP & DOCUMENTATION (DEVELOPER KNOWLEDGE MCP) ===\nYour primary objective for this request is to consult official Google SecOps documentation using the Developer Knowledge MCP tools (search_documents / get_documents). When calling get_documents, pass the exact document parent name(s) returned by search_documents. After retrieving the documents, synthesize a comprehensive, well-structured explanation for the analyst with key takeaways and official links.\n");
  } else if (targetMcpMode === "action") {
    parts.push("\n=== MCP EXECUTION DIRECTIVE: ACTION & LIVE OPERATIONS (SECOPS MCP) ===\nYour primary objective for this request is to perform live SecOps analysis using the Google SecOps Remote MCP tools (e.g. udm_search, list_case_alerts, validate_rule, create_case_comment, list_feeds). Query or validate live telemetry and report concrete findings with explicit provenance.\n");
  }

  return parts.join("\n");
}

/**
 * Format extracted page context into a structured string for Gemini
 */
function buildContextString(pageContext) {
  if (!pageContext) return "";

  const lines = [
    "=== GOOGLE SECOPS CURRENT PAGE CONTEXT ===",
    `URL: ${pageContext.url || "N/A"}`,
    `Page Title: ${pageContext.title || "N/A"}`
  ];

  if (pageContext.userSelection) {
    lines.push(`\n[USER HIGHLIGHTED TEXT / SNIPPET]:`);
    lines.push(`"${pageContext.userSelection}"`);
  }

  const fc = pageContext.featureContext;
  if (fc) {
    lines.push(`\n[ACTIVE FEATURE]: ${fc.feature}`);

    if (fc.feature === "UDM Search") {
      lines.push(`Current Search Query:\n${fc.query}`);
      if (fc.timeRange) lines.push(`Time Range: ${fc.timeRange}`);
    } else if (fc.feature === "YARA-L Rules Editor") {
      lines.push(`Rule Name: ${fc.ruleName}`);
      lines.push(`Rule Code:\n${fc.ruleCode}`);
    } else if (fc.caseId || (fc.feature && fc.feature.includes("Case")) || fc.feature === "Alert & Case Investigation") {
      lines.push(`Case Title: ${fc.caseTitle || "N/A"}`);
      if (fc.caseId) lines.push(`Case ID: ${fc.caseId}`);
      if (fc.subTab) lines.push(`Active Sub-Tab: ${fc.subTab}`);
      if (fc.severity) lines.push(`Severity: ${fc.severity}`);
      if (fc.status) lines.push(`Status: ${fc.status}`);
      if (fc.priority) lines.push(`Priority: ${fc.priority}`);
      if (fc.assignee) lines.push(`Assignee: ${fc.assignee}`);
      if (fc.involvedEntities && fc.involvedEntities.length > 0) {
        lines.push(`Involved Entities: ${fc.involvedEntities.join(", ")}`);
      }
      if (fc.wallActivity && fc.wallActivity.length > 0) {
        lines.push(`\n[RECENT WALL ACTIVITY & COMMENTS]:`);
        fc.wallActivity.forEach((act, idx) => {
          const timePart = act.timestamp ? `[${act.timestamp}] ` : "";
          lines.push(`  ${idx + 1}. ${timePart}${act.author}: ${act.content}`);
        });
      }
    } else if (fc.settingSlug || (fc.feature && fc.feature.startsWith("Settings •"))) {
      lines.push(`Setting Name: ${fc.settingTitle || fc.settingSlug}`);
      if (fc.settingPurpose) lines.push(`Purpose in SecOps: ${fc.settingPurpose}`);
      if (fc.configuredItems && fc.configuredItems.length > 0) {
        lines.push(`\n[CURRENTLY CONFIGURED ITEMS / TABLE ENTRIES]:`);
        fc.configuredItems.forEach((item, idx) => {
          lines.push(`  ${idx + 1}. ${item}`);
        });
      }
      if (fc.activeInputs && fc.activeInputs.length > 0) {
        lines.push(`\n[ACTIVE ON-SCREEN INPUT STATE]:`);
        fc.activeInputs.forEach((inp) => {
          lines.push(`  - ${inp}`);
        });
      }
    } else if (fc.feature === "Google SecOps Documentation") {
      lines.push(`Article: ${fc.docTitle}`);
      if (fc.breadcrumbs) lines.push(`Category: ${fc.breadcrumbs}`);
      if (fc.contentSnippet) lines.push(`Article Content:\n${fc.contentSnippet}`);
    } else if (fc.route === "breach-analytics" || (fc.feature && fc.feature.includes("Breach Analytics"))) {
      if (fc.startTime && fc.endTime) {
        lines.push(`Time Window: ${fc.startTime} to ${fc.endTime}`);
      } else if (fc.timeWindow) {
        lines.push(`Time Window: ${fc.timeWindow}`);
      }
      if (fc.detectionsCount !== undefined) {
        lines.push(`Visible Detection Items: ${fc.detectionsCount}`);
      }
      if (fc.detections && fc.detections.length > 0) {
        lines.push(`\n[VISIBLE BREACH DETECTIONS & IOC MATCHES]:`);
        fc.detections.forEach((det, idx) => {
          lines.push(`  ${idx + 1}. ${det}`);
        });
      }
      if (fc.summary) {
        lines.push(`\nPage Summary: ${fc.summary}`);
      }
    } else if (fc.route === "workdesk" || (fc.feature && fc.feature.startsWith("Workdesk •"))) {
      lines.push(`Workdesk Section: ${fc.subTabTitle || fc.subTab || "Cases"}`);
      if (fc.counters && fc.counters.length > 0) {
        lines.push(`Pending Counters: ${fc.counters.join(", ")}`);
      }
      if (fc.visibleItems && fc.visibleItems.length > 0) {
        lines.push(`\n[VISIBLE WORKDESK ITEMS / CARDS]:`);
        fc.visibleItems.forEach((item, idx) => {
          lines.push(`  ${idx + 1}. ${item}`);
        });
      }
      if (fc.summary) lines.push(`\nPage Summary: ${fc.summary}`);
    } else if (fc.route === "soar-search" || fc.feature === "SOAR Search") {
      lines.push(`Search Query: ${fc.query || "None"}`);
      lines.push(`Active Filter: ${fc.activeFilter || "All"}`);
      if (fc.results && fc.results.length > 0) {
        lines.push(`\n[VISIBLE SEARCH RESULTS]:`);
        fc.results.forEach((res, idx) => {
          lines.push(`  ${idx + 1}. ${res}`);
        });
      }
      if (fc.summary) lines.push(`\nPage Summary: ${fc.summary}`);
    } else if (fc.route === "data-tables" || fc.feature === "Data Tables" || (fc.feature && fc.feature.startsWith("Data Table •"))) {
      if (fc.tableName) lines.push(`Data Table Name: ${fc.tableName}`);
      if (fc.columns && fc.columns.length > 0) {
        lines.push(`Columns: ${fc.columns.join(", ")}`);
      }
      if (fc.visibleRows && fc.visibleRows.length > 0) {
        lines.push(`\n[VISIBLE TABLE ROWS]:`);
        fc.visibleRows.forEach((row, idx) => {
          lines.push(`  ${idx + 1}. ${row}`);
        });
      }
      if (fc.summary) lines.push(`\nPage Summary: ${fc.summary}`);
    } else if (fc.route === "threats" || fc.feature === "Applied Threat Intelligence" || (fc.feature && fc.feature.startsWith("Threats •"))) {
      if (fc.activeTab) lines.push(`Threats Tab: ${fc.activeTab}`);
      if (fc.threatActors && fc.threatActors.length > 0) {
        lines.push(`Visible Threat Actors / Campaigns: ${fc.threatActors.join(", ")}`);
      }
      if (fc.visibleItems && fc.visibleItems.length > 0) {
        lines.push(`\n[VISIBLE THREAT INDICATORS / CAMPAIGNS]:`);
        fc.visibleItems.forEach((item, idx) => {
          lines.push(`  ${idx + 1}. ${item}`);
        });
      }
      if (fc.summary) lines.push(`\nPage Summary: ${fc.summary}`);
    } else if (fc.route === "curated-rules" || fc.feature === "Curated Rules") {
      if (fc.visibleRuleSets && fc.visibleRuleSets.length > 0) {
        lines.push(`\n[VISIBLE CURATED RULE SETS]:`);
        fc.visibleRuleSets.forEach((rs, idx) => {
          lines.push(`  ${idx + 1}. ${rs}`);
        });
      }
      if (fc.summary) lines.push(`\nPage Summary: ${fc.summary}`);
    } else if (fc.route === "rules" || fc.feature === "YARA-L Rules") {
      if (fc.visibleRules && fc.visibleRules.length > 0) {
        lines.push(`\n[VISIBLE DETECTION RULES]:`);
        fc.visibleRules.forEach((rule, idx) => {
          lines.push(`  ${idx + 1}. ${rule}`);
        });
      }
      if (fc.summary) lines.push(`\nPage Summary: ${fc.summary}`);
    } else if (fc.summary) {
      lines.push(`Page Summary: ${fc.summary}`);
    }

    if (fc.detectedErrors && fc.detectedErrors.length > 0) {
      lines.push(`\n[DETECTED ON-SCREEN ERRORS / WARNINGS]:`);
      fc.detectedErrors.forEach((err, idx) => {
        lines.push(`  ${idx + 1}. ${err}`);
      });
    }
  }

  lines.push("=== END CONTEXT ===\n");
  return lines.join("\n");
}

// Export for use in sidepanel and service worker
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SECOPS_SYSTEM_INSTRUCTION, UNSLOP_INSTRUCTION, getSystemInstruction, buildContextString };
} else {
  window.SecOpsPrompts = { SECOPS_SYSTEM_INSTRUCTION, UNSLOP_INSTRUCTION, getSystemInstruction, buildContextString };
}
