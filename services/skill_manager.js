/**
 * Agent Skills Manager for Google SecOps Assistant
 * Loads, persists, and imports SKILL.md definitions via chrome.storage.local
 * Supports two execution modes:
 *  - "ambient": Always injected in background into the system prompt (e.g. Unslop)
 *  - "on-demand": Injected selectively via slash command (e.g. /grill-me, /yara-l, /udm)
 */

const DEFAULT_SKILLS = [
  {
    id: "unslop",
    name: "Unslop Directive",
    command: "/unslop",
    mode: "ambient",
    description: "Cuts AI boilerplate, tells, filler phrases, sycophancy, and unnatural metaphors.",
    tags: ["style", "tone"],
    enabled: true,
    isBuiltin: true,
    content: `CRITICAL WRITING DIRECTIVE (UNSLOP ACTIVE):
Edit text to remove AI patterns, tells, and filler.
1. Content:
   - Superficial -ing phrases: "highlighting...", "ensuring...", "reflecting...". Delete or state concrete mechanisms.
   - Vague attributions: "Experts believe", "Industry reports suggest". Name the source or delete.
2. Language:
   - AI vocabulary: Ban additionally, crucial, delve, enduring, enhance, fostering, garner, interplay, intricate, landscape, pivotal, showcase, tapestry, testament, underscore, vibrant. Replace with plain words.
   - Say "is" or "has" instead of "serves as", "stands as", "boasts".
   - State points directly without "Not just X, but Y."
3. Style:
   - Avoid em dashes entirely. Use periods or commas only.
   - Do not bold every proper noun.
   - Remove emojis from headings, bullets, and body text.
4. Plain Speech:
   - "In order to" becomes "To". "Due to the fact that" becomes "Because".
   - Say what it does, not how it feels.`
  },
  {
    id: "grill-me",
    name: "Grill Me",
    command: "/grill-me",
    mode: "on-demand",
    description: "Relentlessly interview and stress-test assumptions, queries, and logic before finalizing.",
    tags: ["interview", "planning"],
    enabled: true,
    isBuiltin: true,
    content: `GRILL-ME INTERVIEW PROTOCOL:
When this skill is invoked:
1. Do NOT immediately output a final solution or rule without stress-testing assumptions.
2. Interrogate the premise:
   - Identify missing edge cases, scale constraints, false-positive risks, or blind spots in the detection/query logic.
   - For UDM: check if metadata.event_type is appropriate, whether the time window is too broad, and whether the join fields exist in Chronicle.
   - For YARA-L: check whether single vs multi-event sliding window match is required and whether event count conditions are realistic.
3. Ask 2-3 pointed, high-impact clarifying questions with recommended options before proposing the final implementation.
4. Push back constructively if an approach is inefficient, overly permissive, or prone to false positives.`
  },
  {
    id: "yara-l-architect",
    name: "YARA-L Rule Architect",
    command: "/yara-l",
    mode: "on-demand",
    description: "Enforces strict YARA-L 2.0 multi-event correlation syntax, time windows, and condition logic.",
    tags: ["detection", "yara-l"],
    enabled: true,
    isBuiltin: true,
    content: `YARA-L 2.0 RULE CONSTRUCTION GUIDELINES:
1. Mandatory Rule Sections:
   - rule <rule_name> { meta: ... events: ... match: ... condition: ... }
2. Event Variables & Match Windows:
   - Use distinct placeholder variables for multi-event correlations (e.g. $e1, $e2).
   - Multi-event rules MUST declare matching variables in the match section with sliding windows (e.g. $user over 10m).
   - Valid time units are s (seconds), m (minutes), h (hours), d (days).
3. Condition Grammar:
   - Condition statements evaluate event counts or existence (e.g. #e1 > 5, $e1 and $e2).
4. Best Practices:
   - Filter by metadata.event_type early to maximize query engine pruning.
   - Ensure placeholder variables in condition are bound in match section.`
  },
  {
    id: "udm-optimizer",
    name: "UDM Query Optimizer",
    command: "/udm",
    mode: "on-demand",
    description: "Guides high-performance UDM search syntax, canonical noun paths, and index-friendly filters.",
    tags: ["udm", "investigation"],
    enabled: true,
    isBuiltin: true,
    content: `UDM QUERY OPTIMIZATION PRINCIPLES:
1. Canonical UDM Nouns:
   - Always reference canonical fields: principal, target, src, observer, security_result, network, metadata.
2. Index Utilization:
   - Always filter on metadata.event_type first (e.g. metadata.event_type = "USER_LOGIN").
   - Filter on specific IPs, usernames, or domains to prune search partitions before full table scans.
3. String Matching:
   - Use exact match (=) or regex match (/pattern/) appropriately.
   - Avoid open-ended regex with leading wildcards when possible.`
  }
];

window.SecOpsSkillManager = {
  /**
   * Parse a SKILL.md file with YAML frontmatter or standard markdown
   * @param {string} rawText
   * @returns {{ name: string, description: string, command: string, mode: string, tags: string[], content: string }}
   */
  parseSkillMarkdown(rawText) {
    const trimmed = (rawText || "").trim();
    let name = "Custom Skill";
    let description = "";
    let command = "";
    let mode = "on-demand"; // default for custom skills
    let tags = [];
    let content = trimmed;

    // Detect YAML frontmatter between leading --- and ---
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = trimmed.match(frontmatterRegex);

    if (match) {
      const yamlBlock = match[1];
      content = match[2].trim();

      const lines = yamlBlock.split(/\r?\n/);
      let currentMultilineKey = null;
      let multilineBuffer = [];

      const flushMultiline = () => {
        if (currentMultilineKey && multilineBuffer.length > 0) {
          const joined = multilineBuffer.join(" ").trim();
          if (currentMultilineKey === "description") description = joined;
        }
        currentMultilineKey = null;
        multilineBuffer = [];
      };

      for (const line of lines) {
        if (/^\s+/.test(line) && currentMultilineKey) {
          multilineBuffer.push(line.trim());
          continue;
        } else {
          flushMultiline();
        }

        const colonIdx = line.indexOf(":");
        if (colonIdx > -1) {
          const key = line.slice(0, colonIdx).trim().toLowerCase();
          let val = line.slice(colonIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }

          if (val === ">-" || val === ">" || val === "|") {
            currentMultilineKey = key;
            multilineBuffer = [];
            continue;
          }

          if (key === "name") name = val;
          else if (key === "description") description = val;
          else if (key === "command") command = val.startsWith("/") ? val : `/${val}`;
          else if (key === "mode") mode = (val.toLowerCase() === "ambient") ? "ambient" : "on-demand";
          else if (key === "tags") {
            tags = val.replace(/[\[\]]/g, "").split(",").map(t => t.trim()).filter(Boolean);
          }
        }
      }
      flushMultiline();
    } else {
      // Derive name from first H1 heading if present
      const h1Match = trimmed.match(/^#\s+(.+)$/m);
      if (h1Match) {
        name = h1Match[1].trim();
      }
    }

    if (!command) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      command = `/${slug}`;
    }

    return { name, description, command, mode, tags, content };
  },

  /**
   * Retrieve all skills (merging built-in defaults with custom stored skills)
   * @returns {Promise<Array>}
   */
  async getSkills() {
    return new Promise((resolve) => {
      chrome.storage.local.get({ user_skills: [] }, (res) => {
        const userSkills = res.user_skills || [];
        const skillsMap = new Map();

        // 1. Load built-ins
        DEFAULT_SKILLS.forEach((skill) => {
          skillsMap.set(skill.id, { ...skill });
        });

        // 2. Overlay stored skills
        let needsMigrationSave = false;
        userSkills.forEach((skill) => {
          let mergedSkill = { ...skill };
          // If stored with stale folded scalar placeholder (e.g. ">-") and markdown is available, re-parse
          if ((!mergedSkill.description || mergedSkill.description === ">-" || mergedSkill.description === ">" || mergedSkill.description === "|") && (mergedSkill.rawMarkdown || mergedSkill.content)) {
            const reParsed = window.SecOpsSkillManager.parseSkillMarkdown(mergedSkill.rawMarkdown || mergedSkill.content);
            if (reParsed.description && reParsed.description !== ">-") {
              mergedSkill.description = reParsed.description;
              skill.description = reParsed.description;
              needsMigrationSave = true;
            }
          }
          // Auto-migrate stale or synthetic command identifier (e.g. "/custom-mungmib1" -> "/secops-cases")
          if (
            !mergedSkill.command ||
            mergedSkill.command.startsWith("/custom-") ||
            mergedSkill.command === `/${mergedSkill.id}`
          ) {
            const slug = (mergedSkill.name || "skill")
              .toLowerCase()
              .replace(/[^a-z0-9_-]+/g, "-")
              .replace(/(^-|-$)/g, "");
            const cleanCmd = `/${slug}`;
            mergedSkill.command = cleanCmd;
            skill.command = cleanCmd;
            needsMigrationSave = true;
          }

          if (skillsMap.has(mergedSkill.id)) {
            skillsMap.set(mergedSkill.id, { ...skillsMap.get(mergedSkill.id), ...mergedSkill });
          } else {
            skillsMap.set(mergedSkill.id, mergedSkill);
          }
        });

        if (needsMigrationSave) {
          chrome.storage.local.set({ user_skills: userSkills });
        }

        resolve(Array.from(skillsMap.values()));
      });
    });
  },

  /**
   * Retrieve only active/enabled skills
   * @returns {Promise<Array>}
   */
  async getEnabledSkills() {
    const all = await this.getSkills();
    return all.filter((s) => s.enabled !== false);
  },

  /**
   * Retrieve ambient skills that should be injected on every prompt turn
   * @returns {Promise<Array>}
   */
  async getAmbientSkills() {
    const enabled = await this.getEnabledSkills();
    return enabled.filter((s) => s.mode === "ambient");
  },

  /**
   * Retrieve on-demand skills that are invoked via slash command or click
   * @returns {Promise<Array>}
   */
  async getOnDemandSkills() {
    const enabled = await this.getEnabledSkills();
    return enabled.filter((s) => s.mode === "on-demand");
  },

  /**
   * Look up a skill by exact slash command (e.g. "/grill-me")
   * @param {string} cmd
   * @returns {Promise<Object|null>}
   */
  async findSkillByCommand(cmd) {
    if (!cmd) return null;
    const cleanCmd = cmd.trim().toLowerCase();
    const bareCmd = cleanCmd.replace(/^\//, "");
    const all = await this.getSkills();
    return all.find((s) => {
      const sCmd = (s.command || "").toLowerCase();
      const sBareCmd = sCmd.replace(/^\//, "");
      const sId = (s.id || "").toLowerCase();
      const sName = (s.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return (
        sCmd === cleanCmd ||
        sBareCmd === bareCmd ||
        sId === bareCmd ||
        sId.startsWith(`custom-${bareCmd}-`) ||
        sName === bareCmd
      );
    }) || null;
  },

  /**
   * Filter on-demand skills matching a search query or prefix
   * @param {string} prefix
   * @returns {Promise<Array>}
   */
  async findSkillsMatchingPrefix(prefix) {
    const onDemand = await this.getOnDemandSkills();
    if (!prefix || prefix === "/") return onDemand;
    const clean = prefix.toLowerCase();
    return onDemand.filter((s) => 
      s.command.toLowerCase().includes(clean) || 
      s.name.toLowerCase().includes(clean) ||
      (s.description || "").toLowerCase().includes(clean)
    );
  },

  /**
   * Save or update a skill in chrome.storage.local
   * @param {Object} skill
   */
  async saveSkill(skill) {
    const all = await this.getSkills();
    const existingIndex = all.findIndex((s) => s.id === skill.id);

    if (existingIndex > -1) {
      all[existingIndex] = { ...all[existingIndex], ...skill };
    } else {
      all.push({
        id: skill.id || `custom-${Date.now()}`,
        name: skill.name || "Untitled Skill",
        command: skill.command || `/custom-${Date.now().toString(36)}`,
        mode: skill.mode || "on-demand",
        description: skill.description || "",
        tags: skill.tags || ["custom"],
        enabled: skill.enabled !== false,
        isBuiltin: false,
        content: skill.content || ""
      });
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ user_skills: all }, () => {
        resolve(skill);
      });
    });
  },

  /**
   * Delete a custom skill from chrome.storage.local
   * @param {string} skillId
   */
  async deleteSkill(skillId) {
    const all = await this.getSkills();
    const filtered = all.filter((s) => s.id !== skillId || s.isBuiltin);
    const updated = filtered.map((s) => (s.id === skillId ? { ...s, enabled: false } : s));

    return new Promise((resolve) => {
      chrome.storage.local.set({ user_skills: updated }, () => {
        resolve();
      });
    });
  },

  /**
   * Toggle a skill's enabled state
   * @param {string} skillId
   * @param {boolean} enabled
   */
  async toggleSkill(skillId, enabled) {
    const all = await this.getSkills();
    const target = all.find((s) => s.id === skillId);
    if (target) {
      target.enabled = enabled;
      return new Promise((resolve) => {
        chrome.storage.local.set({ user_skills: all }, () => {
          resolve(target);
        });
      });
    }
  },

  /**
   * Import a SKILL.md from a remote URL (e.g. GitHub Raw)
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async importFromUrl(url) {
    const cleanUrl = url.trim();
    if (!cleanUrl) throw new Error("Please enter a valid URL.");

    const resp = await fetch(cleanUrl);
    if (!resp.ok) {
      throw new Error(`Failed to fetch SKILL.md (HTTP ${resp.status}): ${resp.statusText}`);
    }

    const text = await resp.text();
    const parsed = this.parseSkillMarkdown(text);

    const slug = (parsed.name || "skill")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const id = `custom-${slug}-${Date.now().toString(36)}`;

    const newSkill = {
      id: id,
      name: parsed.name,
      command: parsed.command,
      mode: parsed.mode,
      description: parsed.description || `Imported from ${new URL(cleanUrl).hostname}`,
      tags: parsed.tags.length > 0 ? parsed.tags : ["imported"],
      enabled: true,
      isBuiltin: false,
      sourceUrl: cleanUrl,
      rawMarkdown: text,
      content: parsed.content
    };

    await this.saveSkill(newSkill);
    return newSkill;
  }
};
