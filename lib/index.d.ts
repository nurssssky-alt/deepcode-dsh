import type { Context } from "@deepseek-ai/cordis";
import type { RetryPolicyConfig } from "@deepseek-ai/dsh-llm";
import z from "@deepseek-ai/schemastery";

export declare const name = "deepcode";
export declare const inject: string[];
export declare const DEFAULT_PORT = 18801;

export interface Config {
  port?: number;
  autoStartBridge?: boolean;
  defaultModel?: string;
  retryPolicy?: RetryPolicyConfig;
  clashEnabled?: boolean;
  clashApiUrl?: string;
  clashApiSecret?: string;
  clashProxyGroups?: string[];
  clashMode?: "latency" | "sequential";
  clashAutoSwitchOnBlock?: boolean;
  clashProxyUrl?: string;
}

export declare const Config: z<Schemastery.ObjectS<any>, Schemastery.ObjectT<any>, "plain">;

export interface ModelMetadata {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  input: ("text" | "image")[];
  output: string[];
  reasoning: boolean;
}

export declare function fetchOpenCodeModelsCatalog(): Promise<ModelMetadata[]>;

export declare function apply(ctx: Context, config: any): Promise<void>;
