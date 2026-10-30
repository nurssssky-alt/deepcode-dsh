import { createHash } from "crypto";
import canonicalTools from "./src/canonical_tools.json";
import canonicalPromptText from "./src/canonical_system_prompt.txt" with { type: "text" };
import { ClashManager } from "./src/clash";

const PORT = parseInt(process.env.DEEPCODE_PORT || "18801", 10);
const HOST = process.env.DEEPCODE_HOST || "127.0.0.1";
const UPSTREAM = "https://opencode.ai/inference/openai/v1/chat/completions";

const clashManager = new ClashManager();

const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
let lastTimestamp = 0;
let counter = 0;

export function createOpenCodeSessionId(): string {
  const timestamp = Date.now();
  if (timestamp !== lastTimestamp) {
    lastTimestamp = timestamp;
    counter = 0;
  }
  counter++;

  const current = BigInt(timestamp) * 0x1000n + BigInt(counter);
  const value = ~current;
  const time = Array.from({ length: 6 }, (_, index) =>
    Number((value >> BigInt(40 - 8 * index)) & 0xffn)
      .toString(16)
      .padStart(2, "0"),
  ).join("");
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return "ses_" + time + Array.from(bytes, (byte) => chars[byte % 62]).join("");
}

export function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatHostPath(host: string, pathname: string): string | null {
  const cleaned = pathname.replace(/^\/+/, "").replace(/\.git\/?$/, "").replace(/\/+$/, "");
  if (!host || !cleaned) return null;
  return `${host.toLowerCase()}/${cleaned}`;
}

function parseGitRemote(remote: string): string | null {
  const trimmed = remote.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "file:") return null;
    return formatHostPath(url.hostname, url.pathname);
  } catch {
    const scpMatch = trimmed.match(/^([^@/:]+@)?([^/:]+):(.+)$/);
    if (scpMatch) {
      return formatHostPath(scpMatch[2], scpMatch[3]);
    }
  }
  return null;
}

let cachedProjectId: string | null = null;
export function getProjectId(): string {
  if (cachedProjectId) return cachedProjectId;
  try {
    const proc = Bun.spawnSync(["git", "remote", "get-url", "origin"], {
      cwd: process.cwd(),
    });
    if (proc.exitCode === 0) {
      const remote = proc.stdout.toString().trim();
      if (remote) {
        const parsed = parseGitRemote(remote);
        if (parsed) {
          cachedProjectId = createHash("sha1").update(`git-remote:${parsed}`).digest("hex");
          return cachedProjectId;
        }
      }
    }
  } catch {}
  cachedProjectId = "b30087be725059f3700e46e4bc66e8a100122362";
  return cachedProjectId;
}

export function getEnvironmentBlock(): string {
  const cwd = process.cwd();
  const now = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${days[now.getDay()]} ${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;

  return `Today's date: ${dateStr}\n\nHere is some useful information about the environment you are running in:\n<env>\n  Working directory: ${cwd}\n  Workspace root folder: ${cwd}\n  Is directory a git repo: yes\n  Platform: ${process.platform}\n</env>`;
}

export const SUPPORTED_MODELS = [
  {
    id: "glm-5.3-flash-free",
    name: "GLM 5.3 Flash Free",
    context: 614400,
    maxTokens: 32768
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek V4.1 Flash Free",
    context: 1048576,
    maxTokens: 32768
  },
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL Free",
    context: 1048576,
    maxTokens: 131072
  },
  {
    id: "big-pickle",
    name: "Big Pickle Free",
    context: 200000,
    maxTokens: 32768
  },
  {
    id: "muse-spark-1.3-contributor-free",
    name: "Muse Spark 1.3 Contributor Free",
    context: 200000,
    maxTokens: 32768
  }
];

const CANONICAL_TOOL_NAMES = new Set([
  "shell", "read", "write", "edit", "glob", "grep",
  "question", "skill", "subagent", "webfetch", "websearch", "execute"
]);

function formatMcpToolsCatalog(tools?: any[]): string {
  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return "";
  }
  const lines: string[] = ["\n## User Connected Tools & MCP (Code Mode)"];
  lines.push("The following external tools are available to you. You can invoke them via the `execute` tool:");
  for (const t of tools) {
    const fn = t.function || t;
    if (fn.name && !CANONICAL_TOOL_NAMES.has(fn.name)) {
      const desc = fn.description ? ` // ${fn.description}` : "";
      lines.push(`- tools.${fn.name}(input)${desc}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Adapt incoming conversation history from DSH format to OpenCode upstream format.
 */
function adaptIncomingMessages(messages: any[]): any[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) {
      return msg;
    }
    const adaptedCalls = msg.tool_calls.map((tc: any) => {
      const fn = { ...tc.function };
      let name = fn.name;
      let rawArgs = fn.arguments;
      let args: any = {};
      try {
        args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : (rawArgs || {});
      } catch {}

      if (name === "bash") {
        name = "shell";
      } else if (name === "web_search") {
        name = "websearch";
      } else if (name === "web_fetch") {
        name = "webfetch";
      } else if (name === "ask_user_question") {
        name = "question";
      } else if (name === "read") {
        if (args.file_path && !args.path) {
          args.path = args.file_path;
          delete args.file_path;
        }
      } else if (name === "write") {
        if (args.file_path && !args.path && !args.filePath) {
          args.path = args.file_path;
          delete args.file_path;
        }
      } else if (name === "edit") {
        if (args.file_path && !args.filePath) {
          args.filePath = args.file_path;
          delete args.file_path;
        }
        if (args.old_string && !args.oldString) {
          args.oldString = args.old_string;
          delete args.old_string;
        }
        if (args.new_string !== undefined && args.newString === undefined) {
          args.newString = args.new_string;
          delete args.new_string;
        }
        if (args.replace_all !== undefined && args.replaceAll === undefined) {
          args.replaceAll = args.replace_all;
          delete args.replace_all;
        }
      } else if (!CANONICAL_TOOL_NAMES.has(name)) {
        // Unknown canonical tool -> MCP tool invoked via execute
        const mcpName = name;
        name = "execute";
        args = {
          code: `const result = await tools.${mcpName}(${JSON.stringify(args)});\nreturn result;`
        };
      }

      return {
        ...tc,
        function: {
          ...fn,
          name,
          arguments: typeof rawArgs === "string" ? JSON.stringify(args) : args
        }
      };
    });

    return {
      ...msg,
      tool_calls: adaptedCalls
    };
  });
}

function parseExecuteCode(code: string): { toolName: string; args: any } | null {
  const match = code.match(/tools\.([a-zA-Z0-9_-]+)\s*\(([\s\S]*)\)/);
  if (!match) return null;
  const toolName = match[1];
  let rawArgs = match[2].trim();
  if (rawArgs.endsWith(";")) {
    rawArgs = rawArgs.slice(0, -1).trim();
  }
  let args: any = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    try {
      args = new Function("return (" + rawArgs + ")")();
    } catch {}
  }
  return { toolName, args };
}

function translateSingleToolCall(tc: { id?: string; index?: number; name?: string; arguments: string }): {
  id: string;
  name: string;
  arguments: string;
} {
  let name = tc.name || "";
  let rawArgs = tc.arguments || "{}";
  let args: any = {};
  try {
    args = JSON.parse(rawArgs);
  } catch {
    try {
      args = new Function("return (" + rawArgs + ")")();
    } catch {}
  }

  if (name === "execute") {
    const code = args.code || "";
    const parsed = parseExecuteCode(code);
    if (parsed) {
      name = parsed.toolName;
      if (typeof parsed.args === "string") {
        if (name === "bash" || name === "shell") {
          args = { command: parsed.args };
        } else {
          args = { input: parsed.args };
        }
      } else if (typeof parsed.args === "object" && parsed.args !== null) {
        args = parsed.args;
        if (args.input !== undefined && (name === "bash" || name === "shell") && args.command === undefined) {
          args.command = args.input;
        }
      } else {
        args = {};
      }
    }
  }

  if (name === "shell") {
    name = "bash";
  } else if (name === "websearch") {
    name = "web_search";
  } else if (name === "webfetch") {
    name = "web_fetch";
  } else if (name === "question") {
    name = "ask_user_question";
  } else if (name === "read") {
    const path = args.path || args.filePath;
    if (path) {
      args.file_path = path;
    }
  } else if (name === "write") {
    const path = args.path || args.filePath;
    if (path) {
      args.file_path = path;
    }
  } else if (name === "edit") {
    const path = args.path || args.filePath;
    if (path) {
      args.file_path = path;
    }
    if (args.oldString && !args.old_string) {
      args.old_string = args.oldString;
    }
    if (args.newString !== undefined && args.new_string === undefined) {
      args.new_string = args.newString;
    }
    if (args.replaceAll !== undefined && args.replace_all === undefined) {
      args.replace_all = args.replaceAll;
    }
  }

  return {
    id: tc.id || `call_${Date.now()}_${tc.index ?? 0}`,
    name,
    arguments: JSON.stringify(args)
  };
}

/**
 * Creates a TransformStream that parses upstream SSE, streams reasoning and content
 * with zero latency, and normalizes tool_calls to DSH format when they arrive.
 */
function createSseTranslationStream(): TransformStream<Uint8Array, Uint8Array> {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  let lineBuffer = "";

  interface ToolCallAccumulator {
    id?: string;
    index: number;
    name?: string;
    arguments: string;
  }

  const bufferedToolCalls: Map<number, ToolCallAccumulator> = new Map();
  let lastChunkMeta: { id?: string; created?: number; model?: string } = {};

  return new TransformStream({
    transform(chunk, controller) {
      lineBuffer += textDecoder.decode(chunk, { stream: true });
      const lines = lineBuffer.split("\n");
      lineBuffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) {
          controller.enqueue(textEncoder.encode(line + "\n"));
          continue;
        }

        if (trimmed === "data: [DONE]") {
          // Flush any buffered tool calls if still uncommitted
          if (bufferedToolCalls.size > 0) {
            flushBufferedToolCalls(controller, lastChunkMeta, bufferedToolCalls);
          }
          controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
          continue;
        }

        if (trimmed.startsWith("data: ")) {
          const jsonStr = trimmed.slice(6);
          let parsed: any;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            controller.enqueue(textEncoder.encode(line + "\n"));
            continue;
          }

          if (parsed.id) lastChunkMeta.id = parsed.id;
          if (parsed.created) lastChunkMeta.created = parsed.created;
          if (parsed.model) lastChunkMeta.model = parsed.model;

          const choice = parsed.choices?.[0];
          if (!choice) {
            // Usage or empty meta chunk - pass through
            controller.enqueue(textEncoder.encode(line + "\n"));
            continue;
          }

          const delta = choice.delta;

          let hasToolCalls = false;
          if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
            hasToolCalls = true;
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              let item = bufferedToolCalls.get(idx);
              if (!item) {
                item = { index: idx, id: tc.id, name: tc.function?.name, arguments: "" };
                bufferedToolCalls.set(idx, item);
              }
              if (tc.id) item.id = tc.id;
              if (tc.function?.name) item.name = tc.function.name;
              if (tc.function?.arguments) item.arguments += tc.function.arguments;
            }

            if (delta.content || delta.reasoning_content) {
              const contentOnlyChunk = {
                ...parsed,
                choices: [{
                  ...choice,
                  delta: {
                    ...(delta.role ? { role: delta.role } : {}),
                    ...(delta.content ? { content: delta.content } : {}),
                    ...(delta.reasoning_content ? { reasoning_content: delta.reasoning_content } : {})
                  }
                }]
              };
              controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(contentOnlyChunk)}\n\n`));
            }
          }

          if (choice.finish_reason === "tool_calls" || (hasToolCalls && choice.finish_reason)) {
            flushBufferedToolCalls(controller, lastChunkMeta, bufferedToolCalls);
            const finishChunk = {
              ...parsed,
              choices: [{
                index: choice.index ?? 0,
                finish_reason: "tool_calls",
                logprobs: null,
                delta: {}
              }]
            };
            controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(finishChunk)}\n\n`));
            continue;
          }

          if (hasToolCalls) {
            continue;
          }

          // Normal text / reasoning chunk - pass through directly
          controller.enqueue(textEncoder.encode(line + "\n"));
        }
      }
    },

    flush(controller) {
      if (bufferedToolCalls.size > 0) {
        flushBufferedToolCalls(controller, lastChunkMeta, bufferedToolCalls);
      }
      if (lineBuffer.trim().length > 0) {
        controller.enqueue(textEncoder.encode(lineBuffer + "\n"));
      }
    }
  });

  function flushBufferedToolCalls(
    controller: TransformStreamDefaultController<Uint8Array>,
    meta: { id?: string; created?: number; model?: string },
    buffer: Map<number, ToolCallAccumulator>
  ) {
    if (buffer.size === 0) return;

    const translatedList = Array.from(buffer.values())
      .sort((a, b) => a.index - b.index)
      .map(translateSingleToolCall);

    buffer.clear();

    const translatedChunk = {
      id: meta.id || `chatcmpl-${Date.now()}`,
      object: "chat.completion.chunk",
      created: meta.created || Math.floor(Date.now() / 1000),
      model: meta.model || "glm-5.3-flash-free",
      choices: [{
        index: 0,
        finish_reason: null,
        logprobs: null,
        delta: {
          tool_calls: translatedList.map((t, idx) => ({
            index: idx,
            id: t.id,
            type: "function",
            function: {
              name: t.name,
              arguments: t.arguments
            }
          }))
        }
      }]
    };

    controller.enqueue(textEncoder.encode(`data: ${JSON.stringify(translatedChunk)}\n\n`));
  }
}

console.log(`[deepcode] Starting bridge server on http://${HOST}:${PORT}`);

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req) {
    const url = new URL(req.url);

    const corsHeaders: Record<string, string> = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
      "access-control-allow-headers": "*",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === "/health" || url.pathname === "/") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "deepcode-bun-bridge",
        version: "1.0.0",
        uptime: process.uptime(),
        models: SUPPORTED_MODELS.map((m) => m.id),
        clash: clashManager.getStatus(),
      }), {
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    // Clash API endpoints
    if (url.pathname === "/api/clash/status") {
      if (clashManager.getStatus().lastError) {
        await clashManager.probe().catch(() => {});
      }
      return new Response(JSON.stringify(clashManager.getStatus()), {
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    if (url.pathname === "/api/clash/probe") {
      const probeRes = await clashManager.probe().catch((e) => ({ online: false, error: e.message }));
      return new Response(JSON.stringify({ ...probeRes, status: clashManager.getStatus() }), {
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    if (url.pathname === "/api/clash/groups") {
      const groups = await clashManager.getAvailableGroups().catch(() => []);
      return new Response(JSON.stringify({ groups }), {
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    if (url.pathname === "/api/clash/config") {
      if (req.method === "POST") {
        try {
          const body = (await req.json()) as any;
          await clashManager.updateConfig(body);
          return new Response(JSON.stringify({ ok: true, config: clashManager.getConfig(), status: clashManager.getStatus() }), {
            headers: { "content-type": "application/json", ...corsHeaders }
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: corsHeaders });
        }
      }
      return new Response(JSON.stringify(clashManager.getConfig()), {
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    if (url.pathname === "/api/clash/switch" && req.method === "POST") {
      const active = await clashManager.selectBestNode(true);
      return new Response(JSON.stringify({ ok: true, activeNode: active, status: clashManager.getStatus() }), {
        headers: { "content-type": "application/json", ...corsHeaders }
      });
    }

    // Models catalogue
    if (url.pathname === "/v1/models" || url.pathname === "/models") {
      return new Response(JSON.stringify({
        object: "list",
        data: SUPPORTED_MODELS.map((m) => ({
          id: m.id,
          object: "model",
          created: 1729000000,
          owned_by: "opencode",
          name: m.name,
          context_window: m.context,
          max_tokens: m.maxTokens
        }))
      }), {
        headers: { "content-type": "application/json" }
      });
    }

    // Chat completions endpoint
    if (url.pathname === "/v1/chat/completions" || url.pathname === "/chat/completions") {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      try {
        const body = await req.json();
        const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
        const incomingTools = Array.isArray(body.tools) ? body.tools : [];

        // Extract custom system messages from incoming
        const systemParts: string[] = [];
        const nonSystemMessages: any[] = [];

        for (const msg of incomingMessages) {
          if (msg.role === "system") {
            if (typeof msg.content === "string") {
              systemParts.push(msg.content);
            } else if (Array.isArray(msg.content)) {
              systemParts.push(msg.content.map((p: any) => p.text || "").join("\n"));
            }
          } else {
            nonSystemMessages.push(msg);
          }
        }

        const customSystemText = systemParts.join("\n\n").trim();
        const mcpCatalog = formatMcpToolsCatalog(incomingTools);

        let compositeSystemPrompt = canonicalPromptText;
        if (customSystemText || mcpCatalog) {
          compositeSystemPrompt += `\n\n# User Custom Instructions\n${customSystemText || ""}\n${mcpCatalog}`;
        }
        compositeSystemPrompt += `\n\n${getEnvironmentBlock()}`;

        const adaptedHistory = adaptIncomingMessages(nonSystemMessages);

        const upstreamMessages = [
          { role: "system", content: compositeSystemPrompt },
          ...adaptedHistory
        ];

        let rawModel = body.model || "glm-5.3-flash-free";
        if (rawModel.startsWith("opencode/")) {
          rawModel = rawModel.slice("opencode/".length);
        }

        const isStream = body.stream !== false;

        const upstreamBody: Record<string, any> = {
          model: rawModel,
          messages: upstreamMessages,
          tools: canonicalTools,
          stream: isStream,
          stream_options: { include_usage: true },
          max_completion_tokens: typeof body.max_tokens === "number" ? body.max_tokens : 32000
        };

        if (typeof body.temperature === "number") {
          upstreamBody.temperature = body.temperature;
        }

        const maxAttempts = (clashManager.isEnabled() && clashManager.getConfig().autoSwitchOnBlock)
          ? clashManager.getConfig().maxRetries
          : 1;

        let attempt = 0;
        let upstreamResponse: Response | null = null;
        let lastErrText = "";

        while (attempt < maxAttempts) {
          attempt++;

          // Fresh valid session ID with inverted timestamp per attempt
          const sesId = createOpenCodeSessionId();
          const reqId = sesId.replace("ses_", "msg_");
          const traceId = randomHex(16);
          const spanId = randomHex(8);
          const parentSpanId = randomHex(8);

          const upstreamHeaders: Record<string, string> = {
            "authorization": "Bearer public",
            "content-type": "application/json",
            "user-agent": "opencode/latest/2.1.4/cli",
            "x-opencode-client": "cli",
            "x-opencode-project": getProjectId(),
            "x-opencode-session": sesId,
            "x-opencode-session-id": sesId,
            "x-opencode-request": reqId,
            "x-session-affinity": sesId,
            "x-session-id": sesId,
            "traceparent": `00-${traceId}-${spanId}-01`,
            "b3": `${traceId}-${spanId}-1-${parentSpanId}`,
            "accept": "*/*",
            "accept-encoding": "gzip, deflate, br, zstd",
            "connection": "keep-alive"
          };

          const proxyUrl = clashManager.getProxyUrl();
          const fetchOptions: any = {
            method: "POST",
            headers: upstreamHeaders,
            body: JSON.stringify(upstreamBody),
          };
          if (proxyUrl) {
            fetchOptions.proxy = proxyUrl;
          }

          try {
            try {
              upstreamResponse = await fetch(UPSTREAM, fetchOptions);
            } catch (proxyErr: any) {
              if (fetchOptions.proxy && (proxyErr?.message?.includes("ECONNREFUSED") || proxyErr?.message?.includes("Unable to connect"))) {
                console.warn(`[deepcode] Proxy ${fetchOptions.proxy} refused/unreachable (${proxyErr.message}), falling back to direct connection...`);
                delete fetchOptions.proxy;
                upstreamResponse = await fetch(UPSTREAM, fetchOptions);
              } else {
                throw proxyErr;
              }
            }

            if (upstreamResponse.status === 429 || upstreamResponse.status === 403) {
              lastErrText = await upstreamResponse.text();
              console.warn(`[deepcode] Upstream HTTP ${upstreamResponse.status} on attempt ${attempt}/${maxAttempts}: ${lastErrText.slice(0, 150)}`);
              if (attempt < maxAttempts && clashManager.isEnabled() && clashManager.getConfig().autoSwitchOnBlock) {
                console.warn(`[deepcode] Auto-switching proxy node due to HTTP ${upstreamResponse.status}...`);
                await clashManager.handleFailure(upstreamResponse.status);
                continue;
              }
            }
            break;
          } catch (netErr: any) {
            lastErrText = netErr.message;
            console.warn(`[deepcode] Upstream network error on attempt ${attempt}/${maxAttempts}: ${netErr.message}`);
            if (attempt < maxAttempts && clashManager.isEnabled() && clashManager.getConfig().autoSwitchOnBlock) {
              console.warn(`[deepcode] Auto-switching proxy node due to network failure...`);
              await clashManager.handleFailure(504);
              continue;
            }
            throw netErr;
          }
        }

        if (!upstreamResponse || upstreamResponse.status !== 200) {
          const errText = lastErrText || (upstreamResponse ? await upstreamResponse.text() : "Unknown upstream error");
          console.error(`[deepcode] Upstream error HTTP ${upstreamResponse?.status || 502}:`, errText);

          return new Response(errText, {
            status: upstreamResponse?.status || 502,
            headers: { "content-type": "application/json" }
          });
        }

        if (isStream) {
          const transformedStream = upstreamResponse.body!.pipeThrough(createSseTranslationStream());
          return new Response(transformedStream, {
            status: 200,
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache",
              "connection": "keep-alive"
            }
          });
        }

        // Non-streaming response translation
        const resJson = await upstreamResponse.json();
        if (resJson.choices?.[0]?.message?.tool_calls) {
          resJson.choices[0].message.tool_calls = resJson.choices[0].message.tool_calls.map(
            (tc: any) => translateSingleToolCall({
              id: tc.id,
              name: tc.function?.name,
              arguments: tc.function?.arguments || "{}"
            })
          ).map((t: any) => ({
            id: t.id,
            type: "function",
            function: {
              name: t.name,
              arguments: t.arguments
            }
          }));
        }

        return new Response(JSON.stringify(resJson), {
          status: 200,
          headers: { "content-type": "application/json" }
        });

      } catch (err: any) {
        console.error(`[deepcode] Bridge internal error:`, err);
        return new Response(JSON.stringify({
          error: {
            message: err?.message || "Internal Bridge Error",
            type: "deepcode_bridge_error"
          }
        }), {
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    return new Response("Not found", { status: 404 });
  }
});
