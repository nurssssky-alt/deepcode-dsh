# Repository Guidelines & Summary

## Overview

`deepcode` (`@nurssssky/deepcode`, author: **nurssssky**) is a standalone LLM provider plugin for DSH (DeepSeek Harness) that bridges free OpenCode Zen models without requiring `opencode serve`.

### Architecture

1. **Local Bun Bridge ([`bridge.ts`](./bridge.ts))**:
   - Runs on `http://127.0.0.1:18801`.
   - Handles upstream TLS (BoringSSL with Kyber768) to `https://opencode.ai/inference/openai/v1/chat/completions`.
   - Generates valid inverted-timestamp session IDs (`ses_...` and `msg_...`).
   - Injects canonical tools and bi-directionally translates tool calls:
     - DSH `bash` ⇄ OpenCode `shell`
     - Parameter mapping for file tools (`path` / `file_path`)
     - External MCP tools ⇄ OpenCode Code Mode `execute({ code: "tools.<name>(args)" })`.
   - Integrates **Clash Controller ([`src/clash.ts`](./src/clash.ts))**:
     - Connects to Clash / Mihomo / Sing-box REST API (`http://127.0.0.1:9090`).
     - Multi-group node pooling, latency-based node selection against `opencode.ai`, and 5-minute quarantine on 429/403 with `DELETE /connections` socket flushes.
     - Supports live dynamic hot-reload via `POST /api/clash/config`.
2. **DSH Cordis Plugin ([`src/index.ts`](./src/index.ts) → [`lib/index.js`](./lib/index.js))**:
   - Registers a single LLM provider route: `deepcode`.
   - Dynamically pulls model specifications and modalities from `https://models.opencode.ai/api.json` (fallback: local OpenCode SQLite database).
   - Passes native base64 `image_url` blocks for multimodal models without OCR degradation.

---

## Model Context Windows & Modalities

| Model ID | Real Context Window | Max Output Tokens | Modalities |
| :--- | :--- | :--- | :--- |
| `deepseek-v4.1-flash-free` | 1,048,576 (1M) | 32,768 | `text`, `image` |
| `glm-5.3-flash-free` | 614,400 (~600K) | 32,768 | `text`, `image` |
| `nemotron-3.5-super-vl-free` | 1,048,576 (1M) | 131,072 | `text`, `image` |
| `muse-spark-1.3-contributor-free` | 1,048,576 (1M) | 32,768 | `text`, `image` |
| `big-pickle` | 200,000 (200K) | 32,768 | `text` |

---

## Prerequisites & Runtime Requirements

- **Bun is mandatory:** Bun (`bun >= 1.1`) must be installed on the host system. The local bridge server (`bridge.ts`) relies directly on Bun's native HTTP server (`Bun.serve`), built-in TLS, and fast stream transforms. Node.js is not supported for running `bridge.ts`.

---

## Canonical Development Commands

- **Build plugin bundle:**
  ```sh
  bun run build
  ```
- **Typecheck:**
  ```sh
  bun run typecheck
  ```
- **Run bridge server:**
  ```sh
  bun run bridge.ts
  ```
- **Health check:**
  ```sh
  curl -s http://127.0.0.1:18801/health
  ```

---

## Critical Rules & Invariants

1. **Provider Identity:**
   - Keep only `MAIN_PROVIDER = "deepcode"` in `src/index.ts`. Never register multiple aliases (`deepcode`, `OpenCodeZenFree`, etc.) in `ctx.llm.registerAdapter`, as DSH will multiply provider entries in the UI.
2. **Native Vision:**
   - Multimodal models must declare `input: ["text", "image"]`. Never introduce OCR companion bridges (`pi2dsh` image-admission layers).
3. **Communication & Language:**
   - Code, docstrings, commits, and file documentation must be in **English**.
   - User conversation in chat must be in **Russian**.
   - Author attribution is strictly **nurssssky**.
