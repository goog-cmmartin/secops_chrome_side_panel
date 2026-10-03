/**
 * Gemini & Vertex AI Streaming Client with MCP Function Calling & Multimodal Support
 */

window.SecOpsGeminiClient = {
  /**
   * Stream a chat response from Gemini API (AI Studio or Vertex AI)
   * Supports Google Developer Knowledge MCP tools, multimodal images, and cancellation
   * @param {Object} options
   * @param {Array} options.messages - Previous conversation messages [{ role: 'user'|'model', text: '...' }]
   * @param {string} options.userPrompt - Current user input
   * @param {Object} [options.pageContext] - Extracted page context object
   * @param {Object} [options.image] - Optional screenshot { mimeType: 'image/png', data: '<base64>' }
   * @param {boolean} [options.useUnslop=true] - Whether to apply anti-AI writing directives
   * @param {AbortSignal} [options.abortSignal] - Signal to cancel ongoing requests
   * @param {Function} [options.onChunk] - Callback invoked on each streaming token
   * @param {Function} [options.onToolActivity] - Callback invoked when an MCP tool is called
   * @param {Function} [options.onSources] - Callback invoked when documentation sources are discovered
   * @returns {Promise<{ text: string, sources: Array<{ title: string, url: string }> }>}
   */
  async streamChat({
    messages = [],
    userPrompt,
    pageContext = null,
    image = null,
    invokedSkill = null,
    targetMcp = "all",
    useUnslop = true,
    abortSignal = null,
    onChunk,
    onToolActivity,
    onSources
  }) {
    const settings = await window.SecOpsAuthService.getSettings();

    // Detect slash command if not explicitly passed as invokedSkill
    let activeInvokedSkill = invokedSkill;
    let promptText = userPrompt.trim();

    if (!activeInvokedSkill && promptText.startsWith("/") && window.SecOpsSkillManager) {
      const match = promptText.match(/^(\/[a-z0-9\-_]+)(?:\s+([\s\S]*))?$/i);
      if (match) {
        const cmd = match[1];
        const skill = await window.SecOpsSkillManager.findSkillByCommand(cmd);
        if (skill) {
          activeInvokedSkill = skill;
          promptText = (match[2] || "").trim();
        }
      }
    }

    // Contextualize and disambiguate prompt when an on-demand skill is active
    let formattedTaskPrompt = promptText;
    if (activeInvokedSkill) {
      const skillName = activeInvokedSkill.name || "Skill";
      const isCaseSkill = (activeInvokedSkill.id && activeInvokedSkill.id.includes("case")) ||
                          (activeInvokedSkill.command && activeInvokedSkill.command.includes("case")) ||
                          (skillName && skillName.toLowerCase().includes("case"));
      const isCaseIdentifier = /^(?:case\s*#?|#)?\s*\d+$/i.test(promptText);

      if (isCaseSkill && isCaseIdentifier) {
        const cleanId = promptText.replace(/^(?:case\s*#?|#)\s*/i, "").trim();
        formattedTaskPrompt = `[Activated Skill: ${skillName}]
Target: Case #${cleanId}
Mandatory Multi-Step Workflow:
1. Fetch case metadata using get_case(caseId: "${cleanId}").
2. Fetch all linked security alerts using list_case_alerts(caseId: "${cleanId}").
3. Examine the alert detection rules, alert severity, and involved entities as directed by the ${skillName} skill.
CRITICAL: Do NOT terminate the turn or generate your final answer after step 1 alone. You MUST proceed to step 2 (list_case_alerts) before providing the final case and alert assessment.`;
      } else if (!promptText) {
        formattedTaskPrompt = `[Activated Skill: ${skillName}]\nActivate and execute the full ${skillName} protocol following all prescribed workflow steps and tool sequences.`;
      } else {
        formattedTaskPrompt = `[Activated Skill: ${skillName}]\nUser Task / Input: ${promptText}\nExecution Directive: Strictly follow the workflow steps and tool call sequences defined in the "${skillName}" skill. If the workflow prescribes multiple steps or chained tool calls, execute all necessary tool calls across turns. Do NOT stop after a single preliminary tool call.`;
      }
    }

    // Prepare system instruction & context
    const contextPrefix = pageContext ? window.SecOpsPrompts.buildContextString(pageContext) : "";
    const fullUserText = contextPrefix ? `${contextPrefix}\nUser Question / Task: ${formattedTaskPrompt}` : formattedTaskPrompt;

    // Convert message history to Gemini contents format
    const contents = [];
    messages.forEach((msg) => {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }]
      });
    });

    // Build current user prompt parts (text + optional image)
    const userParts = [{ text: fullUserText }];
    if (image && image.data) {
      userParts.push({
        inlineData: {
          mimeType: image.mimeType || "image/png",
          data: image.data
        }
      });
    }

    contents.push({
      role: "user",
      parts: userParts
    });

    const ambientSkills = window.SecOpsSkillManager ? await window.SecOpsSkillManager.getAmbientSkills() : [];
    const systemInstructionText = window.SecOpsPrompts.getSystemInstruction(useUnslop, ambientSkills, activeInvokedSkill, targetMcp);
    let modelName = settings.model || "gemini-3.8-flash";
    // Normalize to Gemini 3.x models only (2.5 is deprecated)
    if (!modelName.startsWith("gemini-3")) {
      modelName = "gemini-3.8-flash";
    }

    let url = "";
    const headers = {
      "Content-Type": "application/json"
    };

    let token = null;
    const project = settings.gcpProject || "";

    if (settings.authMode === "vertexOAuth") {
      if (!project) {
        throw new Error(
          "Google Cloud Project ID is not configured. Please open Settings (⚙️) to enter your Project ID for Vertex AI OAuth."
        );
      }
      token = await window.SecOpsAuthService.getVertexAuthToken(true);
      let region = settings.gcpRegion || "global";

      // Gemini 3.x models on Vertex AI are served globally
      if (modelName.startsWith("gemini-3") && (region === "us-central1" || !region)) {
        region = "global";
      }

      const host = (region && region !== "global") ? `${region}-aiplatform.googleapis.com` : "aiplatform.googleapis.com";
      url = `https://${host}/v1/projects/${project}/locations/${region}/publishers/google/models/${modelName}:streamGenerateContent?alt=sse`;
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      // Gemini API Key mode
      if (!settings.apiKey) {
        throw new Error("Gemini API Key is not set. Please open Settings (⚙️) and enter your key.");
      }
      url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${encodeURIComponent(settings.apiKey)}&alt=sse`;
    }

    // Attach tools if MCP is enabled and client available, honoring targetMcp filter (Help vs Action)
    const useMcp = (settings.enableMcp !== false || settings.enableSecOpsMcp !== false) && window.SecOpsMcpClient;
    const tools = useMcp ? window.SecOpsMcpClient.getGeminiTools(settings, targetMcp) : undefined;

    const MAX_TOOL_TURNS = 6;
    let turn = 0;
    let fullText = "";
    let capturedThoughts = "";
    let lastFinishReason = null;
    let lastBlockReason = null;
    let lastToolExecuted = null;
    let lastToolResult = null;
    const allSources = [];

    while (turn < MAX_TOOL_TURNS) {
      if (abortSignal?.aborted) {
        throw new DOMException("The user aborted a request.", "AbortError");
      }

      turn++;

      const requestPayload = {
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstructionText }]
        },
        generationConfig: {
          temperature: 0.2,
          topP: 0.95,
          maxOutputTokens: 8192,
          thinkingConfig: {
            thinkingLevel: "MEDIUM",
            includeThoughts: true
          }
        }
      };

      if (tools && tools.length > 0) {
        requestPayload.tools = tools;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(requestPayload),
        signal: abortSignal
      });

      if (!response.ok) {
        let errBody = "";
        try {
          errBody = await response.text();
        } catch (e) {
          errBody = response.statusText;
        }

        if (response.status === 401 && settings.authMode === "vertexOAuth") {
          throw new Error("Authentication failed (401). Please re-authenticate your Google Account.");
        }

        throw new Error(`API Error [${response.status}]: ${errBody}`);
      }

      if (!response.body) {
        throw new Error("ReadableStream not supported by browser environment.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let capturedFunctionCall = null;
      let capturedModelPart = null;
      let capturedThoughtSignature = null;
      const modelTurnParts = [];

      while (true) {
        if (abortSignal?.aborted) {
          reader.cancel();
          throw new DOMException("The user aborted a request.", "AbortError");
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.replace(/^data:\s*/, "");
            if (jsonStr === "[DONE]") continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.promptFeedback?.blockReason) {
                lastBlockReason = data.promptFeedback.blockReason;
              }
              const candidate = data.candidates?.[0];
              if (candidate?.finishReason) {
                lastFinishReason = candidate.finishReason;
              }
              const parts = candidate?.content?.parts || [];

              // Capture thought signature if present at candidate level (Vertex AI / Gemini 2.0+)
              if (candidate?.thoughtSignature || candidate?.thought_signature) {
                capturedThoughtSignature = candidate.thoughtSignature || candidate.thought_signature;
              }

              for (const part of parts) {
                const sig = part.thoughtSignature || part.thought_signature || part.functionCall?.thoughtSignature || part.functionCall?.thought_signature;
                if (sig) {
                  capturedThoughtSignature = sig;
                }

                if (part.functionCall) {
                  // Merge functionCall properties in case arguments stream across deltas
                  capturedFunctionCall = {
                    ...(capturedFunctionCall || {}),
                    ...part.functionCall,
                    args: {
                      ...((capturedFunctionCall && capturedFunctionCall.args) || {}),
                      ...((part.functionCall && part.functionCall.args) || {})
                    }
                  };
                  capturedModelPart = {
                    ...part,
                    functionCall: capturedFunctionCall
                  };
                } else if (part.text && typeof part.text === "string" && part.text.trim().length > 0 && !part.thought) {
                  modelTurnParts.push(part);
                  fullText += part.text;
                  if (onChunk) {
                    onChunk(part.text, fullText);
                  }
                } else if (part.thought) {
                  if (typeof part.text === "string") {
                    capturedThoughts += part.text;
                  }
                }
              }
            } catch (parseErr) {
              console.warn("Failed to parse SSE JSON line:", jsonStr, parseErr);
            }
          }
        }
      }

      // If no function call was emitted, generation is complete
      if (!capturedFunctionCall) {
        break;
      }

      // Execute MCP Tool
      const fnName = capturedFunctionCall.name;
      const fnArgs = capturedFunctionCall.args || {};
      let queryStr = fnArgs.query || (fnArgs.names ? fnArgs.names.join(", ") : "");
      if (!queryStr && fnArgs.caseId) {
        queryStr = `Case #${fnArgs.caseId}`;
      } else if (!queryStr && fnArgs.feedId) {
        queryStr = `Feed ${fnArgs.feedId}`;
      } else if (!queryStr && fnArgs.naturalLanguageQuery) {
        queryStr = fnArgs.naturalLanguageQuery;
      }

      if (onToolActivity) {
        onToolActivity({
          tool: fnName,
          query: queryStr
        });
      }

      // Check for mutating operations requiring analyst confirmation
      let mcpResult;
      const isMutating = fnName === "create_case_comment" || fnName === "update_case";
      if (isMutating && onConfirmAction) {
        const confirmed = await onConfirmAction(fnName, fnArgs);
        if (!confirmed) {
          mcpResult = { cancelled: true, message: "Operation cancelled by analyst. No changes were made to SecOps." };
        } else {
          mcpResult = await window.SecOpsMcpClient.callTool(fnName, fnArgs, token, project, abortSignal);
        }
      } else {
        mcpResult = await window.SecOpsMcpClient.callTool(fnName, fnArgs, token, project, abortSignal);
      }
      lastToolExecuted = fnName;
      lastToolResult = mcpResult;

      // Extract sources and notify callback
      if (window.SecOpsMcpClient.extractDocSources) {
        const foundSources = window.SecOpsMcpClient.extractDocSources(fnName, mcpResult, fnArgs);
        for (const src of foundSources) {
          if (!allSources.some((existing) => existing.url === src.url)) {
            allSources.push(src);
          }
        }
        if (allSources.length > 0 && onSources) {
          onSources(allSources);
        }
      }

      // Prepare model turn parts with thought signature intact
      if (!capturedModelPart) {
        capturedModelPart = { functionCall: capturedFunctionCall };
      }
      if (capturedThoughtSignature) {
        // Vertex AI and GenAI API schema uses camelCase thoughtSignature and supports snake_case
        capturedModelPart.thoughtSignature = capturedThoughtSignature;
        capturedModelPart.thought_signature = capturedThoughtSignature;
      }
      if (capturedFunctionCall) {
        capturedModelPart.functionCall = capturedFunctionCall;
      }

      // Add model turn with function call and thought signature to conversation history
      const validPrecedingParts = modelTurnParts.filter(
        (p) => p.text && typeof p.text === "string" && p.text.trim().length > 0 && !p.thought
      );
      const turnParts = validPrecedingParts.length > 0 ? [...validPrecedingParts, capturedModelPart] : [capturedModelPart];
      contents.push({
        role: "model",
        parts: turnParts
      });

      // Add user turn with function response
      const fnResponsePart = {
        functionResponse: {
          name: fnName,
          response: {
            name: fnName,
            content: mcpResult,
            result: mcpResult
          }
        }
      };

      if (capturedFunctionCall.id) {
        fnResponsePart.functionResponse.id = capturedFunctionCall.id;
      }

      contents.push({
        role: "user",
        parts: [fnResponsePart]
      });
    }

    // Fallback resolution if model did not return visible text
    if (!fullText.trim()) {
      if (capturedThoughts.trim()) {
        fullText = capturedThoughts.trim();
        if (onChunk) {
          onChunk(fullText, fullText);
        }
      } else if (lastFinishReason === "SAFETY") {
        fullText = "Response was withheld by Gemini safety filters.";
      } else if (lastFinishReason === "MAX_TOKENS") {
        fullText = "Model output token limit reached before narrative completion.";
      } else if (lastBlockReason) {
        fullText = `Request blocked by safety policy (${lastBlockReason}).`;
      } else if (lastToolExecuted && lastToolResult) {
        if (lastToolResult.error) {
          fullText = `Tool ${lastToolExecuted} returned: ${lastToolResult.error}`;
        } else if (lastToolResult.events && Array.isArray(lastToolResult.events)) {
          fullText = `Retrieved ${lastToolResult.events.length} event record(s) from ${lastToolExecuted}.`;
        } else {
          fullText = `Operation ${lastToolExecuted} completed successfully.`;
        }
      }
    }

    return {
      text: fullText,
      sources: allSources,
      lastTool: lastToolExecuted,
      lastToolResult: lastToolResult
    };
  }
};
