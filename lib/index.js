// src/index.ts
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import z from "@deepseek-ai/schemastery";
import {
  resolveRetryPolicy,
  RetryPolicySchema
} from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import {
  createProvider
} from "@earendil-works/pi-ai";
import { stream as piAgentStream, streamSimple as piAgentStreamSimple } from "@earendil-works/pi-ai/api/openai-completions";
var name = "deepcode";
var inject = ["llm"];
var MAIN_PROVIDER = "deepcode";
var DISPLAY_NAME = "OpenCode Zen Free";
var DEFAULT_PORT = 18801;
var Config = z.object({
  port: z.number().default(DEFAULT_PORT).description("Локальный порт Bun-моста deepcode"),
  autoStartBridge: z.boolean().default(true).description("Автоматически запускать локальный Bun bridge при старте"),
  defaultModel: z.string().default("glm-5.3-flash-free").description("Модель по умолчанию"),
  retryPolicy: RetryPolicySchema.volatile(),
  clashEnabled: z.boolean().default(false).description("Включить управление Clash / Mihomo / Sing-box API"),
  clashApiUrl: z.string().default("http://127.0.0.1:9090").description("URL внешнего контроллера Clash API"),
  clashApiSecret: z.string().role("secret").default("").description("Секретный токен авторизации Clash (если задан)"),
  clashProxyGroups: z.array(z.string()).default([]).description("Группы прокси для пула (пусто = все группы из Clash API)"),
  clashMode: z.union([
    z.const("latency").description("Наименьший пинг до opencode.ai"),
    z.const("sequential").description("По списку (Round-Robin)")
  ]).default("latency").description("Режим выбора узлов"),
  clashAutoSwitchOnBlock: z.boolean().default(true).description("Авто-ротация узлов при 429 (лимит), 403 (бан) и сетевых сбоях"),
  clashProxyUrl: z.string().default("").description("Локальный HTTP/SOCKS5 прокси для трафика моста (оставьте пустым для TUN-режима)")
});
function liveConfig(config) {
  const c = config;
  const val = (prop, fallback) => typeof prop?.get === "function" ? prop.get() : prop ?? fallback;
  return {
    port: val(c.port, DEFAULT_PORT),
    autoStartBridge: val(c.autoStartBridge, true),
    defaultModel: val(c.defaultModel, "glm-5.3-flash-free"),
    retryPolicy: typeof c.retryPolicy?.get === "function" ? c.retryPolicy.get() : c.retryPolicy,
    clashEnabled: val(c.clashEnabled, false),
    clashApiUrl: val(c.clashApiUrl, "http://127.0.0.1:9090"),
    clashApiSecret: val(c.clashApiSecret, ""),
    clashProxyGroups: val(c.clashProxyGroups, []),
    clashMode: val(c.clashMode, "latency"),
    clashAutoSwitchOnBlock: val(c.clashAutoSwitchOnBlock, true),
    clashProxyUrl: val(c.clashProxyUrl, "")
  };
}
var DEFAULT_MODELS = [
  {
    id: "glm-5.3-flash-free",
    name: "GLM 5.3 Flash Free",
    contextWindow: 614400,
    maxTokens: 32768,
    input: ["text", "image"],
    output: ["text"],
    reasoning: true
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek V4.1 Flash Free",
    contextWindow: 1048576,
    maxTokens: 32768,
    input: ["text", "image"],
    output: ["text"],
    reasoning: true
  },
  {
    id: "big-pickle",
    name: "Big Pickle Free",
    contextWindow: 200000,
    maxTokens: 32768,
    input: ["text"],
    output: ["text"],
    reasoning: true
  },
  {
    id: "muse-spark-1.3-contributor-free",
    name: "Muse Spark 1.3 Contributor Free",
    contextWindow: 200000,
    maxTokens: 32768,
    input: ["text", "image"],
    output: ["text"],
    reasoning: true
  },
  {
    id: "nemotron-3.5-super-vl-free",
    name: "Nemotron 3.5 Super VL Free",
    contextWindow: 1048576,
    maxTokens: 131072,
    input: ["text", "image"],
    output: ["text"],
    reasoning: true
  }
];
var OPENCODE_CATALOG_URL = "https://models.opencode.ai/api.json";
function parseCatalogModels(modelsRecord) {
  const result = [];
  for (const [id, m] of Object.entries(modelsRecord)) {
    const isFree = id.endsWith("-free") || id === "big-pickle" || m?.cost?.input === 0 && m?.cost?.output === 0;
    if (!isFree)
      continue;
    const rawInput = Array.isArray(m?.modalities?.input) ? m.modalities.input : ["text"];
    const input = ["text"];
    if (rawInput.includes("image")) {
      input.push("image");
    }
    const output = Array.isArray(m?.modalities?.output) ? m.modalities.output : ["text"];
    const REAL_CONTEXT_WINDOWS = {
      "glm-5.3-flash-free": 614400,
      "deepseek-v4.1-flash-free": 1048576,
      "muse-spark-1.3-contributor-free": 1048576,
      "nemotron-3.5-super-vl-free": 1048576
    };
    const contextWindow = REAL_CONTEXT_WINDOWS[id] || m.limit?.context || 200000;
    result.push({
      id,
      name: m.name || id,
      contextWindow,
      maxTokens: m.limit?.output || 32768,
      input,
      output,
      reasoning: m.reasoning ?? true
    });
  }
  const priority = [
    "glm-5.3-flash-free",
    "deepseek-v4.1-flash-free",
    "big-pickle",
    "muse-spark-1.3-contributor-free",
    "nemotron-3.5-super-vl-free"
  ];
  result.sort((a, b) => {
    const idxA = priority.indexOf(a.id);
    const idxB = priority.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1)
      return idxA - idxB;
    if (idxA !== -1)
      return -1;
    if (idxB !== -1)
      return 1;
    return a.id.localeCompare(b.id);
  });
  return result.length > 0 ? result : [...DEFAULT_MODELS];
}
async function fetchOpenCodeModelsCatalog() {
  try {
    const controller = new AbortController;
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(OPENCODE_CATALOG_URL, {
      signal: controller.signal,
      headers: { "User-Agent": "opencode/1.0.0" }
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const opencodeModels = data?.opencode?.models;
      if (opencodeModels && typeof opencodeModels === "object") {
        return parseCatalogModels(opencodeModels);
      }
    }
  } catch {}
  try {
    const dbPath = join(process.env.HOME || "", ".local/share/opencode/opencode.db");
    if (existsSync(dbPath)) {
      const out = execSync(`sqlite3 "${dbPath}" 'SELECT value FROM kv WHERE key = "models-dev:catalog"'`, {
        encoding: "utf-8",
        timeout: 2000
      });
      if (out) {
        const parsed = JSON.parse(out);
        const body = JSON.parse(parsed.body);
        const opencodeModels = body?.opencode?.models;
        if (opencodeModels && typeof opencodeModels === "object") {
          return parseCatalogModels(opencodeModels);
        }
      }
    }
  } catch {}
  return [...DEFAULT_MODELS];
}
function findBunBinary() {
  const candidatePaths = [
    join(process.env.HOME || "", ".local/npm/bin/bun"),
    "/usr/local/bin/bun",
    join(process.env.HOME || "", ".bun/bin/bun")
  ];
  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "bun";
}
async function isBridgeHealthy(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
    return res.status === 200;
  } catch {
    return false;
  }
}
async function ensureBridgeRunning(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  if (await isBridgeHealthy(baseUrl)) {
    return null;
  }
  const bunBin = findBunBinary();
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const bridgeScript = join(currentDir, "..", "bridge.ts");
  const proc = spawn(bunBin, ["run", bridgeScript], {
    env: { ...process.env, DEEPCODE_PORT: String(port) },
    stdio: "ignore",
    detached: false
  });
  proc.unref();
  const start = Date.now();
  while (Date.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isBridgeHealthy(baseUrl)) {
      break;
    }
  }
  return proc;
}
var PI_AUTH = {
  credentials: {
    read: async () => {
      return;
    },
    list: async () => [],
    modify: async (_providerId, mutate) => mutate(undefined),
    delete: async () => {}
  },
  authContext: { env: async () => {
    return;
  }, fileExists: async () => false }
};
function createModelsForProvider(providerId, baseUrl, modelsList) {
  const thinkingMap = {
    off: null
  };
  return modelsList.map((m) => ({
    id: m.id,
    name: m.name,
    api: "openai-completions",
    provider: providerId,
    baseUrl,
    input: m.input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: m.contextWindow,
    maxTokens: m.maxTokens,
    reasoning: m.reasoning,
    thinkingLevelMap: thinkingMap,
    compat: {
      maxTokensField: "max_tokens",
      supportsReasoningEffort: false,
      requiresReasoningContentOnAssistantMessages: true
    }
  }));
}
async function syncClashConfigToBridge(port, cfg) {
  if (!cfg.clashEnabled)
    return;
  try {
    await fetch(`http://127.0.0.1:${port}/api/clash/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: cfg.clashEnabled,
        apiUrl: cfg.clashApiUrl,
        apiSecret: cfg.clashApiSecret,
        ...cfg.clashProxyGroups?.length ? { proxyGroups: cfg.clashProxyGroups } : {},
        mode: cfg.clashMode,
        autoSwitchOnBlock: cfg.clashAutoSwitchOnBlock,
        proxyUrl: cfg.clashProxyUrl
      })
    });
  } catch {}
}
async function apply(ctx, config) {
  const cfg = liveConfig(config);
  const port = cfg.port || DEFAULT_PORT;
  const bridgeBaseUrl = `http://127.0.0.1:${port}/v1`;
  let bridgeProc = null;
  if (cfg.autoStartBridge) {
    try {
      bridgeProc = await ensureBridgeRunning(port);
      await syncClashConfigToBridge(port, cfg);
    } catch (err) {
      ctx.logger?.(name)?.warn("Не удалось автоматически запустить Bun bridge:", err);
    }
  } else {
    syncClashConfigToBridge(port, cfg).catch(() => {});
  }
  ctx.on("dispose", () => {
    if (bridgeProc && !bridgeProc.killed) {
      try {
        bridgeProc.kill("SIGTERM");
      } catch {}
    }
  });
  ctx.inject(["webServer"], (scoped) => {
    const server = scoped.webServer;
    if (!server || typeof server.register !== "function")
      return;
    server.register({
      kind: "prefix",
      path: "/api/deepcode",
      handler: async (req, res) => {
        try {
          const subPath = req.url.replace(/^\/api\/deepcode/, "") || "/";
          const targetUrl = `http://127.0.0.1:${port}${subPath}`;
          const headers = {};
          if (req.headers["content-type"]) {
            headers["content-type"] = req.headers["content-type"];
          }
          let body = undefined;
          if (req.method === "POST" || req.method === "PUT") {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            body = Buffer.concat(chunks);
          }
          const bridgeRes = await fetch(targetUrl, {
            method: req.method,
            headers,
            body
          });
          res.writeHead(bridgeRes.status, {
            "Content-Type": bridgeRes.headers.get("content-type") || "application/json",
            "Access-Control-Allow-Origin": "*"
          });
          const text = await bridgeRes.text();
          res.end(text);
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ error: err.message }));
        }
      }
    });
  });
  const settingsNs = ctx.fiber?.entry?.options?.id ?? name;
  let modelsMeta = await fetchOpenCodeModelsCatalog();
  const buildProfiles = () => {
    const profiles = new Map;
    const retry = resolveRetryPolicy(cfg.retryPolicy, "retryPolicy");
    const models = createModelsForProvider(MAIN_PROVIDER, bridgeBaseUrl, modelsMeta);
    const piProvider = createProvider({
      id: MAIN_PROVIDER,
      name: DISPLAY_NAME,
      baseUrl: bridgeBaseUrl,
      auth: {
        apiKey: {
          name: "OpenCodeZenFree",
          resolve: () => Promise.resolve({
            auth: { apiKey: "public" },
            source: "OpenCodeZenFree"
          })
        }
      },
      models,
      api: {
        "openai-completions": {
          stream: piAgentStream,
          streamSimple: piAgentStreamSimple
        }
      }
    });
    profiles.set(MAIN_PROVIDER, {
      provider: MAIN_PROVIDER,
      displayName: DISPLAY_NAME,
      apiKeyEnv: credentialRef("OPENCODE_ZEN_FREE_API_KEY"),
      streamIdleTimeoutMs: 300000,
      maxRequestImageBytes: 2097152,
      requestImagePixelBudget: 4194304,
      requestImageMaxBytes: 1048576,
      retryPolicy: retry,
      piProvider,
      modelErrors: new Map,
      configuredMaxTokens: new Map
    });
    return profiles;
  };
  let profiles = buildProfiles();
  const adapter = new PiAiAdapter({
    resolveAttachments: () => ctx.get("attachments"),
    profiles: () => profiles,
    auth: PI_AUTH,
    resolveApiKey: async () => "public"
  });
  ctx.llm.registerConfigurableProviders([
    {
      provider: MAIN_PROVIDER,
      displayName: DISPLAY_NAME,
      settingsNs,
      settingsPath: []
    }
  ]);
  ctx.llm.registerAdapter([MAIN_PROVIDER], adapter);
  ctx.on("loader/volatile-update", async () => {
    try {
      modelsMeta = await fetchOpenCodeModelsCatalog();
    } catch {}
    profiles = buildProfiles();
  });
}
export {
  Config,
  DEFAULT_PORT,
  apply,
  fetchOpenCodeModelsCatalog,
  inject,
  name
};
