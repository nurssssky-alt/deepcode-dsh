# deepcode

Seamless OpenCode Zen free models provider for DeepSeek Harness (DSH).

---

## Highlights

- **Native Multimodality (Vision):** Direct image input via standard `image_url` base64 blocks — no OCR degradation or text replacement.
- **Dynamic Catalog:** Automatically resolves supported models and capabilities from `models.opencode.ai/api.json` with local SQLite fallback.
- **True Context Limits:** Exposes full backend context windows to prevent premature client-side compaction:
  - **DeepSeek V4.1 Flash Free:** 1,048,576 tokens (1M)
  - **GLM 5.3 Flash Free:** 614,400 tokens (~600K)
  - **Nemotron 3.5 Super VL Free:** 1,048,576 tokens (1M)
  - **Muse Spark 1.3 Contributor Free:** 1,048,576 tokens (1M)
  - **Big Pickle Free:** 200,000 tokens (200K)
- **MCP & Tool Calling:** Bi-directional translation between DSH system tools (`bash`, `read`, `write`, `edit`), external MCPs, and OpenCode canonical Code Mode tools.
- **Dedicated Settings UI:** Native settings section (`⚙️ DeepCode`) in the DSH Settings modal sidebar to configure Clash API, manage multi-group proxy pools, trigger instant node failover, and inspect model context windows in real time.
- **Clash & Sing-box Controller:** Multi-group proxy pooling, background latency testing directly to `opencode.ai`, and transparent failover on 429 / 403 / network drops with 5-minute node quarantine and socket flushing (`DELETE /connections`).
- **Lightweight Local Bridge:** Standalone Bun HTTP proxy (`bridge.ts` on port `18801`) managing BoringSSL/Kyber768 TLS handshakes and timestamped session signatures without `opencode serve`.

---

## Installation

Link the local package into your DSH web profile:

```sh
# Install directly from GitHub:
dsh plugin --profile web add github:nurssssky-alt/deepcode-dsh

# Or link a local clone for development:
dsh plugin --profile web add link:/path/to/deepcode
```

---

## Configuration

In `~/.dsh/profiles/web/cordis.patch.yml`:

```yaml
- id: deepcode
  name: '@nurssssky/deepcode'
  disabled: false
  config:
    port: 18801
    autoStartBridge: true
    defaultModel: deepseek-v4.1-flash-free
    retryPolicy:
      mode: normal
      maxRetries: 1

    # Optional Clash / Mihomo / Sing-box API Controller:
    clashEnabled: true
    clashApiUrl: 'http://127.0.0.1:9090'
    clashApiSecret: '' # token if configured in Clash
    clashProxyGroups: [] # empty array = automatically include all groups detected from Clash API
    clashMode: latency # 'latency' (lowest ping to opencode.ai) or 'sequential'
    clashAutoSwitchOnBlock: true # auto-failover on 429/403 with 5-minute quarantine
    clashProxyUrl: '' # local inbound proxy (leave empty for TUN mode)

- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: deepcode
    model: deepseek-v4.1-flash-free
```

---

## How the OpenCode Zen Gatekeeper Works (Reverse Engineering)

Upstream OpenCode (`opencode.ai`) protects its free model tier behind an application-level gatekeeper that rejects unverified third-party calls with `HTTP 429 FreeUsageLimitError: "Free models work in OpenCode"`.

Through binary bytecode deconstruction and network traffic differential analysis, we identified the 4 key validation checks enforced by upstream:

1. **Canonical Environment Block (`<env>`)**: The system prompt must terminate with an authentic OpenCode environment XML block. Omitting `<env>` triggers immediate gatekeeper rejection.
2. **Project Identity (`x-opencode-project`)**: Requires a valid 40-character hexadecimal SHA-1 digest representing the workspace project.
3. **W3C Distributed Tracing**: Authentic OpenCode CLI requests emit W3C `traceparent` and Zipkin `b3` telemetry headers.
4. **Token Generation Sizing (`max_completion_tokens`)**: Enforces `max_completion_tokens: 32000` rather than legacy `max_tokens`.

For the complete technical breakdown and decompilation findings, read [**`RESEARCH.md`**](./RESEARCH.md).

---

## Manual Bridge Execution

The plugin automatically spawns the bridge, but you can also run it independently:

```sh
bun run bridge.ts
```

Check health:

```sh
curl http://127.0.0.1:18801/health
```

---

## License

MIT © 2026 nurssssky
