/**
 * Clash / Mihomo / Sing-box External Controller Client & Proxy Manager
 * Handles multi-group pooling, latency-based node selection to opencode.ai,
 * automatic failover on 429/403/connection errors with node quarantine,
 * and socket flushing via DELETE /connections.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ClashConfig {
  enabled: boolean;
  apiUrl: string;
  apiSecret: string;
  proxyGroups: string[];
  mode: "latency" | "sequential";
  autoSwitchOnBlock: boolean;
  proxyUrl: string;
  targetTestUrl: string;
  quarantineMs: number;
  maxRetries: number;
}

export const DEFAULT_CLASH_CONFIG: ClashConfig = {
  enabled: false,
  apiUrl: "http://127.0.0.1:9090",
  apiSecret: "",
  proxyGroups: [],
  mode: "latency",
  autoSwitchOnBlock: true,
  proxyUrl: "",
  targetTestUrl: "https://opencode.ai/favicon.ico",
  quarantineMs: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
};

function getConfigFile(): string {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  if (!existsSync(dshHome)) {
    try { mkdirSync(dshHome, { recursive: true }); } catch {}
  }
  return join(dshHome, "deepcode.json");
}

function loadSavedConfig(): Partial<ClashConfig> {
  try {
    const file = getConfigFile();
    if (existsSync(file)) {
      const text = readFileSync(file, "utf8");
      return JSON.parse(text);
    }
  } catch (e: any) {
    console.warn("[deepcode] Failed to read ~/.dsh/deepcode.json:", e.message);
  }
  return {};
}

function saveConfigToDisk(config: ClashConfig): void {
  try {
    const file = getConfigFile();
    writeFileSync(file, JSON.stringify(config, null, 2), "utf8");
  } catch (e: any) {
    console.error("[deepcode] Failed to write ~/.dsh/deepcode.json:", e.message);
  }
}

export interface ProxyNodeInfo {
  name: string;
  group: string;
  type: string;
  latency?: number;
}

export class ClashManager {
  private config: ClashConfig;
  private quarantinedNodes: Map<string, number> = new Map(); // nodeName -> expiryTimestamp
  private nodeLatencies: Map<string, { latency: number; testedAt: number }> = new Map();
  private currentNode: ProxyNodeInfo | null = null;
  private sequentialIndex = 0;
  private bgTimer: any = null;
  private lastError: string | null = null;
  private lastVersion: string | null = null;

  constructor(initialConfig: Partial<ClashConfig> = {}) {
    const saved = loadSavedConfig();
    this.config = { ...DEFAULT_CLASH_CONFIG, ...saved, ...initialConfig };
    // Probe on boot to see if Clash is available
    this.probe().catch(() => {});
    if (this.config.enabled) {
      this.startBackgroundLatencyCheck();
    }
  }

  public getConfig(): ClashConfig {
    return { ...this.config };
  }

  public async updateConfig(newConfig: Partial<ClashConfig>): Promise<void> {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };
    saveConfigToDisk(this.config);

    await this.probe().catch(() => {});

    if (!wasEnabled && this.config.enabled) {
      this.startBackgroundLatencyCheck();
      await this.selectBestNode(true).catch(() => {});
    } else if (wasEnabled && !this.config.enabled) {
      this.stopBackgroundLatencyCheck();
      this.currentNode = null;
    }
  }

  public async probe(): Promise<{ online: boolean; version?: string; error?: string }> {
    try {
      const res = await fetch(`${this.config.apiUrl}/version`, {
        headers: this.getAuthHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        this.lastVersion = data.version || "Clash / sing-box";
        this.lastError = null;
        return { online: true, version: this.lastVersion || undefined };
      } else {
        const text = await res.text();
        this.lastError = `Clash API returned HTTP ${res.status}: ${text}`;
        return { online: false, error: this.lastError };
      }
    } catch (err: any) {
      this.lastError = `Failed to connect to Clash API at ${this.config.apiUrl}: ${err.message}`;
      return { online: false, error: this.lastError };
    }
  }

  public async getAvailableGroups(): Promise<string[]> {
    const proxies = await this.fetchProxies();
    if (!proxies) return [];
    const groups: string[] = [];
    for (const [name, data] of Object.entries(proxies)) {
      if (data && Array.isArray((data as any).all) && (data as any).all.length > 0) {
        groups.push(name);
      }
    }
    return groups;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getProxyUrl(): string | undefined {
    if (!this.config.enabled) return undefined;
    const url = this.config.proxyUrl.trim();
    return url.length > 0 ? url : undefined;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiSecret) {
      headers["Authorization"] = `Bearer ${this.config.apiSecret}`;
    }
    return headers;
  }

  /**
   * Fetch all proxies and groups from Clash API
   */
  public async fetchProxies(): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(`${this.config.apiUrl}/proxies`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) {
        this.lastError = `Clash API error (${res.status}): ${await res.text()}`;
        return null;
      }
      const data = (await res.json()) as any;
      this.lastError = null;
      return data.proxies || null;
    } catch (err: any) {
      this.lastError = `Failed to connect to Clash API at ${this.config.apiUrl}: ${err.message}`;
      return null;
    }
  }

  /**
   * Collect all selectable nodes across all configured groups into a combined pool
   */
  public async getCombinedPool(): Promise<ProxyNodeInfo[]> {
    const proxies = await this.fetchProxies();
    if (!proxies) return [];

    const pool: ProxyNodeInfo[] = [];
    const seenNodes = new Set<string>();

    const targetGroups = this.config.proxyGroups.length > 0
      ? this.config.proxyGroups
      : Object.keys(proxies).filter((g) => proxies[g]?.all && Array.isArray(proxies[g].all) && proxies[g].all.length > 0);

    for (const groupName of targetGroups) {
      const groupData = proxies[groupName];
      if (!groupData || !Array.isArray(groupData.all)) continue;

      for (const nodeName of groupData.all) {
        // Skip special selector pseudo-nodes like DIRECT, REJECT, or nested groups unless they are nodes
        if (nodeName === "DIRECT" || nodeName === "REJECT" || nodeName === "COMPATIBLE") continue;
        const key = `${groupName}::${nodeName}`;
        if (!seenNodes.has(key)) {
          seenNodes.add(key);
          const nodeData = proxies[nodeName];
          pool.push({
            name: nodeName,
            group: groupName,
            type: nodeData?.type || "unknown",
            latency: this.nodeLatencies.get(nodeName)?.latency,
          });
        }
      }
    }

    return pool;
  }

  /**
   * Test latency of a specific node against target URL (default: opencode.ai)
   */
  public async testNodeDelay(nodeName: string): Promise<number | null> {
    try {
      const query = new URLSearchParams({
        url: this.config.targetTestUrl,
        timeout: "3000",
      });
      const url = `${this.config.apiUrl}/proxies/${encodeURIComponent(nodeName)}/delay?${query.toString()}`;
      const res = await fetch(url, { headers: this.getAuthHeaders() });
      if (!res.ok) return null;

      const data = (await res.json()) as any;
      if (typeof data.delay === "number" && data.delay > 0) {
        this.nodeLatencies.set(nodeName, { latency: data.delay, testedAt: Date.now() });
        return data.delay;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Put a node on quarantine (5 min cooldown by default)
   */
  public quarantineNode(nodeName: string, durationMs?: number): void {
    const ms = durationMs || this.config.quarantineMs;
    const expiry = Date.now() + ms;
    this.quarantinedNodes.set(nodeName, expiry);
    console.warn(`[clash] Node "${nodeName}" quarantined for ${Math.round(ms / 1000)}s`);
  }

  public isQuarantined(nodeName: string): boolean {
    const expiry = this.quarantinedNodes.get(nodeName);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.quarantinedNodes.delete(nodeName);
      return false;
    }
    return true;
  }

  /**
   * Switch active node in Clash for a specific proxy group
   */
  public async switchNodeInGroup(groupName: string, nodeName: string): Promise<boolean> {
    try {
      const url = `${this.config.apiUrl}/proxies/${encodeURIComponent(groupName)}`;
      const res = await fetch(url, {
        method: "PUT",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name: nodeName }),
      });
      if (!res.ok) {
        console.error(`[clash] Failed to switch ${groupName} -> ${nodeName}: ${res.status}`);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error(`[clash] Error switching ${groupName} -> ${nodeName}:`, err.message);
      return false;
    }
  }

  /**
   * Flush active connections to drop sockets pinned to old nodes
   */
  public async flushConnections(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.apiUrl}/connections`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Select best node from combined pool according to mode and activate it in Clash
   */
  public async selectBestNode(force = false): Promise<ProxyNodeInfo | null> {
    const pool = await this.getCombinedPool();
    if (pool.length === 0) return null;

    // Filter out quarantined nodes
    const candidates = pool.filter((n) => !this.isQuarantined(n.name));
    const selectionPool = candidates.length > 0 ? candidates : pool; // Fallback to all if all are quarantined

    let chosen: ProxyNodeInfo | null = null;

    if (this.config.mode === "latency") {
      // Find candidate with lowest known latency
      let bestLatency = Infinity;
      for (const node of selectionPool) {
        const cached = this.nodeLatencies.get(node.name);
        const lat = cached ? cached.latency : Infinity;
        if (lat < bestLatency) {
          bestLatency = lat;
          chosen = node;
        }
      }
      // If no node has cached latency yet, test top candidate or pick first
      if (!chosen || bestLatency === Infinity) {
        chosen = selectionPool[0];
      }
    } else {
      // Sequential (Round-Robin)
      this.sequentialIndex = (this.sequentialIndex + 1) % selectionPool.length;
      chosen = selectionPool[this.sequentialIndex];
    }

    if (chosen) {
      const switched = await this.switchNodeInGroup(chosen.group, chosen.name);
      if (switched) {
        await this.flushConnections();
        this.currentNode = chosen;
        console.log(`[clash] Active proxy node switched to "${chosen.name}" in group "${chosen.group}"`);
      }
    }

    return this.currentNode;
  }

  /**
   * Handle failure (429, 403, or connection drop) during a request
   */
  public async handleFailure(statusCode: number): Promise<ProxyNodeInfo | null> {
    if (this.currentNode) {
      this.quarantineNode(this.currentNode.name);
    }
    return await this.selectBestNode(true);
  }

  /**
   * Background latency check across combined pool
   */
  public startBackgroundLatencyCheck(intervalMs = 10 * 60 * 1000): void {
    this.stopBackgroundLatencyCheck();
    const runCheck = async () => {
      try {
        const pool = await this.getCombinedPool();
        for (const node of pool) {
          if (!this.config.enabled) break;
          await this.testNodeDelay(node.name);
          // Small pause between tests to not flood the proxy
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err: any) {
        console.warn("[clash] Background latency test warning:", err.message);
      }
    };

    // Run first check after 3 seconds
    setTimeout(runCheck, 3000);
    this.bgTimer = setInterval(runCheck, intervalMs);
  }

  public stopBackgroundLatencyCheck(): void {
    if (this.bgTimer) {
      clearInterval(this.bgTimer);
      this.bgTimer = null;
    }
  }

  /**
   * Status overview for UI / Health check
   */
  public getStatus(): Record<string, any> {
    const quarantined: string[] = [];
    for (const [name, expiry] of this.quarantinedNodes.entries()) {
      if (Date.now() < expiry) {
        quarantined.push(`${name} (expires in ${Math.round((expiry - Date.now()) / 1000)}s)`);
      } else {
        this.quarantinedNodes.delete(name);
      }
    }

    return {
      enabled: this.config.enabled,
      apiUrl: this.config.apiUrl,
      proxyGroups: this.config.proxyGroups,
      mode: this.config.mode,
      autoSwitchOnBlock: this.config.autoSwitchOnBlock,
      proxyUrl: this.config.proxyUrl,
      version: this.lastVersion,
      currentNode: this.currentNode
        ? {
            name: this.currentNode.name,
            group: this.currentNode.group,
            latency: this.nodeLatencies.get(this.currentNode.name)?.latency || null,
          }
        : null,
      quarantinedNodes: quarantined,
      lastError: this.lastError,
    };
  }
}
