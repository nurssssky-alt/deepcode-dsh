# deepcode

Seamless OpenCode Zen free models provider for DeepSeek Harness (DSH).

Author: **nurssssky**

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

- id: agent-default-model
  name: '@deepseek-ai/dsh-agent-default-model'
  config:
    provider: deepcode
    model: deepseek-v4.1-flash-free
```

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
