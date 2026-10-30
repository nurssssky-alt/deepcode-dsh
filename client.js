/**
 * DeepCode — DSH Web Client Extension
 * Registers the dedicated 'DeepCode' section in the left sidebar of DSH Settings,
 * providing interactive model roster, context limits, live Clash API controller,
 * multi-group pool editor, and real-time node switching diagnostics.
 */

window.__ModuleLoader__.load({
  id: "@nurssssky/deepcode",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require("react");
    const { createElement: h, useState, useEffect, useCallback, useMemo } = React;

    const CSS_STYLES = `
      .dc-root {
        padding: 24px;
        max-width: 880px;
        margin: 0 auto;
        color: #f1f5f9;
        font-family: inherit;
        box-sizing: border-box;
      }
      .dc-header {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .dc-title {
        font-size: 20px;
        font-weight: 600;
        margin: 0 0 4px 0;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #ffffff;
      }
      .dc-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
      }
      .dc-badge {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
      }
      .dc-badge-green {
        background: rgba(46, 213, 115, 0.16);
        color: #2ed573;
        border: 1px solid rgba(46, 213, 115, 0.3);
      }
      .dc-badge-gray {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.65);
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .dc-badge-red {
        background: rgba(255, 71, 87, 0.16);
        color: #ff4757;
        border: 1px solid rgba(255, 71, 87, 0.3);
      }
      .dc-badge-blue {
        background: rgba(37, 99, 235, 0.18);
        color: #60a5fa;
        border: 1px solid rgba(37, 99, 235, 0.35);
      }
      .dc-card {
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 9px;
        padding: 18px 20px;
        margin-bottom: 18px;
      }
      .dc-card-title {
        font-size: 15px;
        font-weight: 600;
        margin: 0 0 14px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #ffffff;
      }
      .dc-row {
        margin-bottom: 14px;
      }
      .dc-row:last-child {
        margin-bottom: 0;
      }
      .dc-label {
        font-size: 13px;
        font-weight: 550;
        color: #f8fafc;
        margin-bottom: 6px;
        display: block;
      }
      .dc-hint {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.55);
        margin-top: 4px;
        display: block;
        line-height: 1.4;
      }
      .dc-input {
        width: 100%;
        padding: 8px 11px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(0, 0, 0, 0.35);
        color: #ffffff;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s ease;
      }
      .dc-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 1px #3b82f6;
      }
      .dc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .dc-chip {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: #f1f5f9;
        padding: 3px 9px;
        border-radius: 5px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .dc-chip-remove {
        cursor: pointer;
        opacity: 0.6;
        font-weight: bold;
        transition: opacity 0.15s;
      }
      .dc-chip-remove:hover {
        opacity: 1;
        color: #ff4757;
      }
      .dc-btn {
        padding: 7px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 550;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
        box-sizing: border-box;
      }
      .dc-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .dc-btn-primary {
        background: #2563eb !important;
        color: #ffffff !important;
        border-color: #3b82f6 !important;
      }
      .dc-btn-primary:hover:not(:disabled) {
        background: #1d4ed8 !important;
        border-color: #2563eb !important;
      }
      .dc-btn-secondary {
        background: rgba(255, 255, 255, 0.08) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255, 255, 255, 0.16) !important;
      }
      .dc-btn-secondary:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.14) !important;
        border-color: rgba(255, 255, 255, 0.28) !important;
      }
      .dc-btn-small {
        padding: 3px 8px;
        font-size: 11px;
        border-radius: 4px;
      }
      .dc-toggle-wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dc-switch {
        position: relative;
        display: inline-block;
        width: 42px;
        height: 22px;
        cursor: pointer;
      }
      .dc-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      .dc-slider {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: rgba(255, 255, 255, 0.2);
        transition: .2s;
        border-radius: 22px;
      }
      .dc-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .2s;
        border-radius: 50%;
      }
      .dc-switch input:checked + .dc-slider {
        background-color: #2563eb !important;
      }
      .dc-switch input:checked + .dc-slider:before {
        transform: translateX(20px);
      }
      .dc-models-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 10px;
        margin-top: 10px;
      }
      .dc-model-card {
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 7px;
      }
      .dc-model-name {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 5px 0;
        color: #ffffff;
      }
      .dc-model-meta {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `;

    function ensureStyles() {
      if (document.getElementById("deepcode-client-styles")) return;
      const style = document.createElement("style");
      style.id = "deepcode-client-styles";
      style.textContent = CSS_STYLES;
      document.head.appendChild(style);
    }

    const MODELS = [
      { id: "deepseek-v4.1-flash-free", name: "DeepSeek V4.1 Flash Free", ctx: "1,048,576 (1M)", out: "32,768", vision: true },
      { id: "glm-5.3-flash-free", name: "GLM 5.3 Flash Free", ctx: "614,400 (~600K)", out: "32,768", vision: true },
      { id: "nemotron-3.5-super-vl-free", name: "Nemotron 3.5 Super VL Free", ctx: "1,048,576 (1M)", out: "131,072", vision: true },
      { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor Free", ctx: "1,048,576 (1M)", out: "32,768", vision: true },
      { id: "big-pickle", name: "Big Pickle Free", ctx: "200,000 (200K)", out: "32,768", vision: false },
    ];

    async function callBridge(path, options = {}) {
      try {
        const direct = await fetch(`http://127.0.0.1:18801${path}`, options);
        if (direct.ok || direct.status === 400 || direct.status === 429) return direct;
      } catch {
        // Direct loopback fetch failed, fallback to DSH same-origin route
      }
      return fetch(`/api/deepcode${path}`, options);
    }

    function DeepCodeSettingsSection() {
      useEffect(() => {
        ensureStyles();
      }, []);

      const [bridgeHealthy, setBridgeHealthy] = useState(false);
      const [status, setStatus] = useState(null);
      const [availableGroups, setAvailableGroups] = useState([]);
      const [config, setConfig] = useState({
        enabled: false,
        apiUrl: "http://127.0.0.1:9090",
        apiSecret: "",
        proxyGroups: [],
        mode: "latency",
        autoSwitchOnBlock: true,
        proxyUrl: "http://127.0.0.1:7890",
      });
      const [newGroupInput, setNewGroupInput] = useState("");
      const [saveNotice, setSaveNotice] = useState("");
      const [loading, setLoading] = useState(false);

      const fetchStatusAndConfig = useCallback(async () => {
        try {
          const res = await callBridge("/health");
          if (res.ok) {
            setBridgeHealthy(true);
            const data = await res.json();
            if (data.clash) {
              setStatus(data.clash);
              setConfig((prev) => ({
                ...prev,
                enabled: data.clash.enabled ?? prev.enabled,
                apiUrl: data.clash.apiUrl ?? prev.apiUrl,
                proxyGroups: data.clash.proxyGroups ?? prev.proxyGroups,
                mode: data.clash.mode ?? prev.mode,
                autoSwitchOnBlock: data.clash.autoSwitchOnBlock ?? prev.autoSwitchOnBlock,
                proxyUrl: data.clash.proxyUrl ?? prev.proxyUrl,
              }));
            }
          } else {
            setBridgeHealthy(false);
          }
        } catch {
          setBridgeHealthy(false);
        }

        // Fetch available groups in Clash
        try {
          const grpRes = await callBridge("/api/clash/groups");
          if (grpRes.ok) {
            const grpData = await grpRes.json();
            if (Array.isArray(grpData.groups)) {
              setAvailableGroups(grpData.groups);
            }
          }
        } catch {}
      }, []);

      useEffect(() => {
        fetchStatusAndConfig();
        const interval = setInterval(fetchStatusAndConfig, 5000);
        return () => clearInterval(interval);
      }, [fetchStatusAndConfig]);

      const saveConfig = async (nextConfig, showNotice = false) => {
        setLoading(true);
        try {
          const res = await callBridge("/api/clash/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextConfig),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status) setStatus(data.status);
            if (showNotice) {
              setSaveNotice("Настройки сохранены");
              setTimeout(() => setSaveNotice(""), 3000);
            }
          } else {
            if (showNotice) {
              setSaveNotice("Ошибка сохранения");
            }
          }
        } catch (e) {
          if (showNotice) {
            setSaveNotice("Ошибка связи с мостом: " + e.message);
          }
        } finally {
          setLoading(false);
        }
      };

      const handleTestProbe = async () => {
        setLoading(true);
        try {
          const res = await callBridge("/api/clash/probe");
          if (res.ok) {
            const data = await res.json();
            if (data.online) {
              setSaveNotice(`API доступен (${data.version})`);
              if (data.status) setStatus(data.status);
            } else {
              setSaveNotice(`Ошибка: ${data.error || "Не отвечает"}`);
            }
            setTimeout(() => setSaveNotice(""), 4000);
          }
        } catch (e) {
          setSaveNotice("Ошибка проверки: " + e.message);
        } finally {
          setLoading(false);
        }
      };

      const handleManualSwitch = async () => {
        setLoading(true);
        try {
          const res = await callBridge("/api/clash/switch", {
            method: "POST",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status) setStatus(data.status);
            setSaveNotice(`Активный узел: ${data.activeNode || "выбран"}`);
            setTimeout(() => setSaveNotice(""), 3000);
          }
        } catch (e) {
          setSaveNotice("Ошибка переключения: " + e.message);
        } finally {
          setLoading(false);
        }
      };

      const toggleEnabled = async (checked) => {
        const next = { ...config, enabled: checked };
        setConfig(next);
        await saveConfig(next);
      };

      const toggleAutoSwitch = async (checked) => {
        const next = { ...config, autoSwitchOnBlock: checked };
        setConfig(next);
        await saveConfig(next);
      };

      const selectMode = async (mode) => {
        const next = { ...config, mode };
        setConfig(next);
        await saveConfig(next);
      };

      const addGroup = (groupToAdd) => {
        const val = typeof groupToAdd === "string" ? groupToAdd : newGroupInput;
        const trimmed = val.trim();
        if (trimmed && !config.proxyGroups.includes(trimmed)) {
          const next = { ...config, proxyGroups: [...config.proxyGroups, trimmed] };
          setConfig(next);
          setNewGroupInput("");
          saveConfig(next);
        }
      };

      const removeGroup = (name) => {
        const next = {
          ...config,
          proxyGroups: config.proxyGroups.filter((g) => g !== name),
        };
        setConfig(next);
        saveConfig(next);
      };

      return h("div", { className: "dc-root" },
        // Header
        h("div", { className: "dc-header" },
          h("div", null,
            h("h1", { className: "dc-title" },
              "DeepCode",
              bridgeHealthy
                ? h("span", { className: "dc-badge dc-badge-green" }, "Bridge :18801")
                : h("span", { className: "dc-badge dc-badge-red" }, "Bridge остановлен")
            ),
            h("p", { className: "dc-subtitle" }, "Провайдер бесплатных моделей OpenCode Zen и контроллер Clash")
          ),
          h("div", { style: { display: "flex", gap: "8px" } },
            h("button", {
              className: "dc-btn dc-btn-secondary",
              onClick: fetchStatusAndConfig,
              disabled: loading
            }, "Обновить")
          )
        ),

        // Live Clash Status
        h("div", { className: "dc-card" },
          h("div", { className: "dc-card-title" },
            "Статус контроллера",
            status?.enabled
              ? (status?.lastError
                  ? h("span", { className: "dc-badge dc-badge-red", style: { marginLeft: "auto" } }, "Ошибка подключения")
                  : h("span", { className: "dc-badge dc-badge-green", style: { marginLeft: "auto" } }, `Активен (${status?.version || "Online"})`))
              : (status?.version
                  ? h("span", { className: "dc-badge dc-badge-blue", style: { marginLeft: "auto" } }, `API доступен (${status.version})`)
                  : h("span", { className: "dc-badge dc-badge-gray", style: { marginLeft: "auto" } }, "Отключен"))
          ),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "13px" } },
            h("div", null,
              h("span", { style: { opacity: 0.65 } }, "Текущий активный узел: "),
              h("strong", { style: { color: "#ffffff" } }, status?.currentNode?.name || "Не выбран / Direct"),
              status?.currentNode?.group ? h("span", { style: { opacity: 0.6 } }, ` (${status.currentNode.group})`) : null
            ),
            h("div", null,
              h("span", { style: { opacity: 0.65 } }, "Задержка до opencode.ai: "),
              h("strong", { style: { color: status?.currentNode?.latency ? "#2ed573" : "#ffffff" } }, status?.currentNode?.latency ? `${status.currentNode.latency} ms` : "—")
            ),
            h("div", null,
              h("span", { style: { opacity: 0.65 } }, "Режим выбора: "),
              h("span", { style: { color: "#ffffff" } }, config.mode === "latency" ? "Наименьшая задержка" : "По очереди")
            ),
            h("div", null,
              h("span", { style: { opacity: 0.65 } }, "Узлов в карантине (429/403): "),
              h("span", { style: { color: status?.quarantinedNodes?.length > 0 ? "#ff4757" : "#ffffff" } }, status?.quarantinedNodes?.length > 0 ? status.quarantinedNodes.length : "0")
            )
          ),
          status?.lastError && status?.enabled
            ? h("div", { style: { marginTop: "12px", color: "#ff4757", fontSize: "12px", background: "rgba(255,71,87,0.12)", border: "1px solid rgba(255,71,87,0.3)", padding: "8px 12px", borderRadius: "6px" } },
                "Ошибка: " + status.lastError
              )
            : null,
          h("div", { style: { marginTop: "14px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" } },
            h("button", {
              className: "dc-btn dc-btn-secondary",
              onClick: handleTestProbe,
              disabled: loading
            }, "Проверить соединение"),
            status?.enabled
              ? h("button", {
                  className: "dc-btn dc-btn-primary",
                  onClick: handleManualSwitch,
                  disabled: loading
                }, "Сменить узел")
              : null,
            saveNotice ? h("span", { style: { fontSize: "13px", fontWeight: "500", color: saveNotice.startsWith("Ошибка") ? "#ff4757" : "#2ed573" } }, saveNotice) : null
          )
        ),

        // Clash API Settings Form
        h("div", { className: "dc-card" },
          h("div", { className: "dc-card-title" }, "Параметры Clash API"),

          // Enable Clash
          h("div", { className: "dc-row dc-toggle-wrap" },
            h("div", null,
              h("span", { className: "dc-label" }, "Включить управление Clash API"),
              h("span", { className: "dc-hint" }, "Маршрутизация и автоматическая ротация прокси-узлов через внешний контроллер")
            ),
            h("label", { className: "dc-switch" },
              h("input", {
                type: "checkbox",
                checked: config.enabled,
                onChange: (e) => toggleEnabled(e.target.checked)
              }),
              h("span", { className: "dc-slider" })
            )
          ),

          // API URL & Secret
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" } },
            h("div", null,
              h("label", { className: "dc-label" }, "URL контроллера Clash API"),
              h("input", {
                className: "dc-input",
                value: config.apiUrl,
                onChange: (e) => setConfig({ ...config, apiUrl: e.target.value }),
                placeholder: "http://127.0.0.1:9090"
              })
            ),
            h("div", null,
              h("label", { className: "dc-label" }, "Секретный токен (Secret)"),
              h("input", {
                className: "dc-input",
                type: "password",
                value: config.apiSecret,
                onChange: (e) => setConfig({ ...config, apiSecret: e.target.value }),
                placeholder: "Токен авторизации (если задан)"
              })
            )
          ),

          // Mode Selection
          h("div", { className: "dc-row", style: { marginTop: "16px" } },
            h("label", { className: "dc-label" }, "Режим выбора прокси-узлов"),
            h("div", { style: { display: "flex", gap: "10px" } },
              h("button", {
                type: "button",
                className: `dc-btn ${config.mode === "latency" ? "dc-btn-primary" : "dc-btn-secondary"}`,
                onClick: () => selectMode("latency")
              }, "Наименьшая задержка"),
              h("button", {
                type: "button",
                className: `dc-btn ${config.mode === "sequential" ? "dc-btn-primary" : "dc-btn-secondary"}`,
                onClick: () => selectMode("sequential")
              }, "По очереди")
            ),
            h("span", { className: "dc-hint" }, config.mode === "latency" ? "Задержка тестируется до opencode.ai" : "Узлы переключаются последовательно из общего пула")
          ),

          // Multi-Group Pool Management
          h("div", { className: "dc-row", style: { marginTop: "16px" } },
            h("label", { className: "dc-label" }, "Объединенный пул прокси-групп"),
            h("div", { className: "dc-chips" },
              config.proxyGroups.length === 0
                ? h("span", { style: { fontSize: "12px", opacity: 0.65, fontStyle: "italic", padding: "4px 0" } }, "Все группы из Clash API (пул не ограничен)")
                : config.proxyGroups.map((group) =>
                    h("span", { key: group, className: "dc-chip" },
                      group,
                      h("span", {
                        className: "dc-chip-remove",
                        onClick: () => removeGroup(group),
                        title: "Удалить группу из пула"
                      }, "✕")
                    )
                  )
            ),
            h("div", { style: { display: "flex", gap: "8px", marginTop: "8px" } },
              h("input", {
                className: "dc-input",
                style: { maxWidth: "280px" },
                value: newGroupInput,
                onChange: (e) => setNewGroupInput(e.target.value),
                onKeyDown: (e) => { if (e.key === "Enter") addGroup(); },
                placeholder: "Имя группы (например, Default)"
              }),
              h("button", {
                type: "button",
                className: "dc-btn dc-btn-secondary",
                onClick: () => addGroup()
              }, "+ Добавить")
            ),
            // Discovered groups in Clash
            availableGroups.length > 0
              ? h("div", { style: { marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
                  h("span", { style: { fontSize: "12px", opacity: 0.65 } }, "Обнаружены в Clash:"),
                  availableGroups.map((grp) =>
                    !config.proxyGroups.includes(grp)
                      ? h("button", {
                          key: grp,
                          type: "button",
                          className: "dc-btn dc-btn-secondary dc-btn-small",
                          onClick: () => addGroup(grp)
                        }, `+ ${grp}`)
                      : null
                  )
                )
              : null,
            h("span", { className: "dc-hint" }, "Узлы из этих групп объединяются в единый пул. Мост активирует лучший узел в его группе.")
          ),

          // Auto-failover on 429/403
          h("div", { className: "dc-row dc-toggle-wrap", style: { marginTop: "16px" } },
            h("div", null,
              h("span", { className: "dc-label" }, "Авто-ротация при 429, 403 и таймаутах"),
              h("span", { className: "dc-hint" }, "Отправляет сбойный узел в 5-минутный карантин, сбрасывает соединения и повторяет запрос")
            ),
            h("label", { className: "dc-switch" },
              h("input", {
                type: "checkbox",
                checked: config.autoSwitchOnBlock,
                onChange: (e) => toggleAutoSwitch(e.target.checked)
              }),
              h("span", { className: "dc-slider" })
            )
          ),

          // Outbound Local Proxy URL
          h("div", { className: "dc-row", style: { marginTop: "16px" } },
            h("label", { className: "dc-label" }, "Локальный прокси порт для исходящего трафика моста"),
            h("input", {
              className: "dc-input",
              value: config.proxyUrl,
              onChange: (e) => setConfig({ ...config, proxyUrl: e.target.value }),
              placeholder: "http://127.0.0.1:7890 (оставьте пустым при системном TUN-режиме)"
            }),
            h("span", { className: "dc-hint" }, "Если включен системный TUN/VPN-режим, оставьте это поле пустым")
          ),

          // Action Buttons
          h("div", { style: { marginTop: "20px", display: "flex", alignItems: "center", gap: "12px" } },
            h("button", {
              className: "dc-btn dc-btn-primary",
              onClick: () => saveConfig(config, true),
              disabled: loading
            }, loading ? "Сохранение..." : "Сохранить настройки"),
            saveNotice ? h("span", { style: { fontSize: "13px", fontWeight: "500", color: saveNotice.startsWith("Ошибка") ? "#ff4757" : "#2ed573" } }, saveNotice) : null
          )
        ),

        // Available Models
        h("div", { className: "dc-card" },
          h("div", { className: "dc-card-title" }, "Бесплатные модели OpenCode Zen"),
          h("p", { className: "dc-hint", style: { marginTop: "-8px", marginBottom: "14px" } },
            "Все модели работают без регистрации и API ключа. Контекст передается без урезания на клиенте."
          ),
          h("div", { className: "dc-models-grid" },
            MODELS.map((m) =>
              h("div", { key: m.id, className: "dc-model-card" },
                h("div", { className: "dc-model-name" }, m.name),
                h("div", { className: "dc-model-meta" },
                  h("span", null, `Контекст: ${m.ctx}`),
                  h("span", null, `Вывод: ${m.out}`),
                  m.vision ? h("span", { style: { color: "#2ed573", fontWeight: "500" } }, "Vision") : null
                )
              )
            )
          )
        )
      );
    }

    const NAV_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/><polygon points="13 2 9 13 12 13 11 22 15 11 12 11 13 2" fill="currentColor" stroke="none"/></svg>';
    const NAV_ICON_MASK = `data:image/svg+xml,${encodeURIComponent(NAV_ICON_SVG)}`;

    const NAV_CSS = `
      [data-dsh-deepcode-nav] > svg { display: none !important; }
      [data-dsh-deepcode-nav]::before {
        content: '';
        flex: none;
        width: 16px;
        height: 16px;
        background-color: currentColor;
        -webkit-mask-image: url("${NAV_ICON_MASK}");
        mask-image: url("${NAV_ICON_MASK}");
        -webkit-mask-repeat: no-repeat;
        mask-repeat: no-repeat;
        -webkit-mask-position: center;
        mask-position: center;
        -webkit-mask-size: 16px 16px;
        mask-size: 16px 16px;
      }
    `;

    function apply(ctx) {
      if (typeof document !== "undefined") {
        const style = document.createElement("style");
        style.setAttribute("data-plugin", "@nurssssky/deepcode");
        style.setAttribute("data-plugin-css", "nav-icon");
        style.textContent = NAV_CSS;
        document.head.appendChild(style);

        const syncNav = () => {
          const rows = document.querySelectorAll('[role="dialog"] nav button, [class*="SettingsPanel"] nav button, [class*="_navItem"]');
          for (const row of rows) {
            const text = (row.textContent || "").trim();
            if (text === "DeepCode") {
              row.setAttribute("data-dsh-deepcode-nav", "");
            }
          }
        };

        syncNav();
        const obs = new MutationObserver(syncNav);
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });

        ctx.effect?.(() => () => {
          obs.disconnect();
          style.remove();
        });
      }

      ctx.slots.inject("settings.section", () =>
        ctx.slots.register({
          name: "settings.section",
          id: "deepcode",
          order: 36,
          label: () => "DeepCode",
        }, (props) => h(DeepCodeSettingsSection, props))
      );
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.name = "@nurssssky/deepcode";
    return module.exports;
  },
});
