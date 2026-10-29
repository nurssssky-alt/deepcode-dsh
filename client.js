/**
 * DeepCode — DSH Web Client Extension
 * Registers the dedicated 'DeepCode' section in the left sidebar of DSH Settings,
 * providing interactive model roster, context limits, live Clash API controller,
 * multi-group pool editor, and real-time node switching diagnostics.
 */

window.__ModuleLoader__.load({
  id: '@nurssssky/deepcode',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require('react');
    const { createElement: h, useState, useEffect, useCallback, useMemo } = React;

    const CSS_STYLES = `
      .dc-root {
        padding: 24px;
        max-width: 860px;
        margin: 0 auto;
        color: var(--dsw-alias-label-primary, #ffffff);
        font-family: inherit;
      }
      .dc-header {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.1));
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .dc-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 6px 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .dc-subtitle {
        font-size: 13px;
        color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.6));
        margin: 0;
      }
      .dc-badge {
        font-size: 11px;
        font-weight: 500;
        padding: 3px 8px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .dc-badge-green {
        background: rgba(46, 213, 115, 0.15);
        color: #2ed573;
        border: 1px solid rgba(46, 213, 115, 0.3);
      }
      .dc-badge-gray {
        background: rgba(255, 255, 255, 0.08);
        color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.6));
        border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.1));
      }
      .dc-badge-red {
        background: rgba(255, 71, 87, 0.15);
        color: #ff4757;
        border: 1px solid rgba(255, 71, 87, 0.3);
      }
      .dc-card {
        background: var(--dsw-alias-bg-layer-2, rgba(255,255,255,0.04));
        border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08));
        border-radius: 10px;
        padding: 20px;
        margin-bottom: 20px;
      }
      .dc-card-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0 0 16px 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dc-row {
        margin-bottom: 16px;
      }
      .dc-row:last-child {
        margin-bottom: 0;
      }
      .dc-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--dsw-alias-label-primary, #ffffff);
        margin-bottom: 6px;
        display: block;
      }
      .dc-hint {
        font-size: 12px;
        color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.5));
        margin-top: 4px;
        display: block;
      }
      .dc-input {
        width: 100%;
        padding: 9px 12px;
        border-radius: 7px;
        border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.15));
        background: var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.25));
        color: #ffffff;
        font-size: 13px;
        outline: none;
        box-sizing: border-box;
      }
      .dc-input:focus {
        border-color: var(--dsw-alias-brand-primary, #3b82f6);
      }
      .dc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }
      .dc-chip {
        background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,0.1));
        border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.2));
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .dc-chip-remove {
        cursor: pointer;
        opacity: 0.6;
        font-weight: bold;
      }
      .dc-chip-remove:hover {
        opacity: 1;
        color: #ff4757;
      }
      .dc-btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .dc-btn-primary {
        background: var(--dsw-alias-brand-primary, #3b82f6);
        color: #ffffff;
      }
      .dc-btn-primary:hover {
        opacity: 0.9;
      }
      .dc-btn-secondary {
        background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,0.1));
        color: #ffffff;
        border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.15));
      }
      .dc-btn-secondary:hover {
        background: rgba(255,255,255,0.15);
      }
      .dc-toggle-wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .dc-switch {
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
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
        background-color: rgba(255,255,255,0.2);
        transition: .2s;
        border-radius: 24px;
      }
      .dc-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .2s;
        border-radius: 50%;
      }
      .dc-switch input:checked + .dc-slider {
        background-color: var(--dsw-alias-brand-primary, #3b82f6);
      }
      .dc-switch input:checked + .dc-slider:before {
        transform: translateX(20px);
      }
      .dc-models-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .dc-model-card {
        padding: 12px 14px;
        background: var(--dsw-alias-bg-layer-1, rgba(0,0,0,0.2));
        border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08));
        border-radius: 8px;
      }
      .dc-model-name {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 6px 0;
      }
      .dc-model-meta {
        font-size: 11px;
        color: var(--dsw-alias-label-secondary, rgba(255,255,255,0.6));
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
    `;

    function ensureStyles() {
      if (document.getElementById('deepcode-client-styles')) return;
      const style = document.createElement('style');
      style.id = 'deepcode-client-styles';
      style.textContent = CSS_STYLES;
      document.head.appendChild(style);
    }

    const MODELS = [
      { id: "deepseek-v4.1-flash-free", name: "DeepSeek V4.1 Flash", ctx: "1,048,576 (1M)", out: "32K", vision: true },
      { id: "glm-5.3-flash-free", name: "GLM 5.3 Flash", ctx: "614,400 (~600K)", out: "32K", vision: true },
      { id: "nemotron-3.5-super-vl-free", name: "Nemotron 3.5 Super VL", ctx: "1,048,576 (1M)", out: "131K", vision: true },
      { id: "muse-spark-1.3-contributor-free", name: "Muse Spark 1.3 Contributor", ctx: "1,048,576 (1M)", out: "32K", vision: true },
      { id: "big-pickle", name: "Big Pickle", ctx: "200,000 (200K)", out: "32K", vision: false },
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
      const [config, setConfig] = useState({
        enabled: false,
        apiUrl: "http://127.0.0.1:9090",
        apiSecret: "",
        proxyGroups: ["nursssskyvpn", "key.f0rtuna.fast", "subs.eu-fffast.com", "Default"],
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
      }, []);

      useEffect(() => {
        fetchStatusAndConfig();
        const interval = setInterval(fetchStatusAndConfig, 5000);
        return () => clearInterval(interval);
      }, [fetchStatusAndConfig]);

      const handleSave = async () => {
        setLoading(true);
        try {
          const res = await callBridge("/api/clash/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status) setStatus(data.status);
            setSaveNotice("✓ Настройки успешно применены на лету!");
            setTimeout(() => setSaveNotice(""), 3000);
          } else {
            setSaveNotice("✕ Ошибка сохранения настроек");
          }
        } catch (e) {
          setSaveNotice("✕ Не удалось связаться с мостом: " + e.message);
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
            setSaveNotice("✓ Прокси успешно переключён!");
            setTimeout(() => setSaveNotice(""), 3000);
          }
        } catch (e) {
          setSaveNotice("✕ Ошибка переключения: " + e.message);
        } finally {
          setLoading(false);
        }
      };

      const addGroup = () => {
        const trimmed = newGroupInput.trim();
        if (trimmed && !config.proxyGroups.includes(trimmed)) {
          setConfig({ ...config, proxyGroups: [...config.proxyGroups, trimmed] });
          setNewGroupInput("");
        }
      };

      const removeGroup = (name) => {
        setConfig({
          ...config,
          proxyGroups: config.proxyGroups.filter((g) => g !== name),
        });
      };

      return h("div", { className: "dc-root" },
        // Header
        h("div", { className: "dc-header" },
          h("div", null,
            h("h1", { className: "dc-title" },
              "DeepCode",
              bridgeHealthy
                ? h("span", { className: "dc-badge dc-badge-green" }, "● Bridge Active (:18801)")
                : h("span", { className: "dc-badge dc-badge-red" }, "● Bridge Stopped")
            ),
            h("p", { className: "dc-subtitle" }, "Standalone OpenCode Zen Free Models & Clash Controller для DSH")
          ),
          h("button", {
            className: "dc-btn dc-btn-secondary",
            onClick: fetchStatusAndConfig,
            disabled: loading
          }, "↻ Обновить")
        ),

        // Live Clash Status
        h("div", { className: "dc-card" },
          h("div", { className: "dc-card-title" },
            "📊 Статус Clash / Sing-box контроллера",
            status?.enabled
              ? (status?.lastError
                  ? h("span", { className: "dc-badge dc-badge-red", style: { marginLeft: "auto" } }, "● Ошибка подключения")
                  : h("span", { className: "dc-badge dc-badge-green", style: { marginLeft: "auto" } }, "● Clash Подключён"))
              : h("span", { className: "dc-badge dc-badge-gray", style: { marginLeft: "auto" } }, "○ Выключен")
          ),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" } },
            h("div", null,
              h("span", { style: { opacity: 0.6 } }, "Текущий активный узел: "),
              h("strong", null, status?.currentNode?.name || "Не выбран / Direct"),
              status?.currentNode?.group ? h("span", { style: { opacity: 0.5 } }, ` (в ${status.currentNode.group})`) : null
            ),
            h("div", null,
              h("span", { style: { opacity: 0.6 } }, "Задержка до opencode.ai: "),
              h("strong", null, status?.currentNode?.latency ? `${status.currentNode.latency} ms` : "—")
            ),
            h("div", null,
              h("span", { style: { opacity: 0.6 } }, "Режим выбора: "),
              h("span", null, config.mode === "latency" ? "⚡️ Наименьший пинг" : "🔄 По списку (Round-Robin)")
            ),
            h("div", null,
              h("span", { style: { opacity: 0.6 } }, "Узлов в карантине (429/403): "),
              h("span", null, status?.quarantinedNodes?.length > 0 ? status.quarantinedNodes.length : "0")
            )
          ),
          status?.lastError
            ? h("div", { style: { marginTop: "12px", color: "#ff4757", fontSize: "12px", background: "rgba(255,71,87,0.1)", padding: "8px 12px", borderRadius: "6px" } },
                "Ошибка: " + status.lastError
              )
            : null,
          status?.enabled
            ? h("div", { style: { marginTop: "14px", display: "flex", gap: "10px" } },
                h("button", {
                  className: "dc-btn dc-btn-secondary",
                  onClick: handleManualSwitch,
                  disabled: loading
                }, "⚡️ Замерить пинг и сменить узел")
              )
            : null
        ),

        // Clash API Settings Form
        h("div", { className: "dc-card" },
          h("div", { className: "dc-card-title" }, "⚙️ Настройки Clash / Sing-box API"),

          // Enable Clash
          h("div", { className: "dc-row dc-toggle-wrap" },
            h("div", null,
              h("span", { className: "dc-label" }, "Включить управление Clash API"),
              h("span", { className: "dc-hint" }, "Автоматическая маршрутизация и ротация прокси-узлов через внешний контроллер")
            ),
            h("label", { className: "dc-switch" },
              h("input", {
                type: "checkbox",
                checked: config.enabled,
                onChange: (e) => setConfig({ ...config, enabled: e.target.checked })
              }),
              h("span", { className: "dc-slider" })
            )
          ),

          // API URL & Secret
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" } },
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
                placeholder: "Токен авторизации (если есть)"
              })
            )
          ),

          // Mode Selection
          h("div", { className: "dc-row", style: { marginTop: "14px" } },
            h("label", { className: "dc-label" }, "Режим выбора прокси-узлов"),
            h("div", { style: { display: "flex", gap: "10px" } },
              h("button", {
                type: "button",
                className: `dc-btn ${config.mode === "latency" ? "dc-btn-primary" : "dc-btn-secondary"}`,
                onClick: () => setConfig({ ...config, mode: "latency" })
              }, "⚡️ Наименьший пинг до opencode.ai"),
              h("button", {
                type: "button",
                className: `dc-btn ${config.mode === "sequential" ? "dc-btn-primary" : "dc-btn-secondary"}`,
                onClick: () => setConfig({ ...config, mode: "sequential" })
              }, "🔄 По очереди (Round-Robin)")
            ),
            h("span", { className: "dc-hint" }, config.mode === "latency" ? "Пинг тестируется прямо до opencode.ai в фоне каждые 10 минут" : "Узлы переключаются по порядку из объединенного пула")
          ),

          // Multi-Group Pool Management
          h("div", { className: "dc-row" },
            h("label", { className: "dc-label" }, "Объединенный пул прокси-групп"),
            h("div", { className: "dc-chips" },
              config.proxyGroups.map((group) =>
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
            h("div", { style: { display: "flex", gap: "8px", marginTop: "6px" } },
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
                onClick: addGroup
              }, "+ Добавить группу")
            ),
            h("span", { className: "dc-hint" }, "Все ноды из этих групп собираются в единый пул. Мост активирует лучшую ноду в её группе.")
          ),

          // Auto-failover on 429/403
          h("div", { className: "dc-row dc-toggle-wrap", style: { marginTop: "16px" } },
            h("div", null,
              h("span", { className: "dc-label" }, "Авто-ротация при 429, 403 и таймаутах"),
              h("span", { className: "dc-hint" }, "Отправляет сбойную ноду в 5-минутный карантин, сбрасывает сокеты и повторяет запрос")
            ),
            h("label", { className: "dc-switch" },
              h("input", {
                type: "checkbox",
                checked: config.autoSwitchOnBlock,
                onChange: (e) => setConfig({ ...config, autoSwitchOnBlock: e.target.checked })
              }),
              h("span", { className: "dc-slider" })
            )
          ),

          // Outbound Local Proxy URL
          h("div", { className: "dc-row", style: { marginTop: "14px" } },
            h("label", { className: "dc-label" }, "Локальный прокси порт для исходящего трафика моста"),
            h("input", {
              className: "dc-input",
              value: config.proxyUrl,
              onChange: (e) => setConfig({ ...config, proxyUrl: e.target.value }),
              placeholder: "http://127.0.0.1:7890 (оставьте пустым при включенном TUN-режиме)"
            }),
            h("span", { className: "dc-hint" }, "Если в вашей прокси-программе включен системный TUN/VPN-режим, оставьте это поле пустым")
          ),

          // Action Buttons
          h("div", { style: { marginTop: "20px", display: "flex", alignItems: "center", gap: "12px" } },
            h("button", {
              className: "dc-btn dc-btn-primary",
              onClick: handleSave,
              disabled: loading
            }, loading ? "Сохранение..." : "💾 Применить настройки на лету"),
            saveNotice ? h("span", { style: { fontSize: "13px", color: saveNotice.startsWith("✓") ? "#2ed573" : "#ff4757" } }, saveNotice) : null
          )
        ),

        // Available Models
        h("div", { className: "dc-card" },
          h("div", { className: "dc-card-title" }, "🤖 Доступные бесплатные модели OpenCode Zen"),
          h("p", { className: "dc-hint", style: { marginTop: "-10px", marginBottom: "14px" } },
            "Все модели работают без регистрации и API ключа. Контекст не урезается на клиенте."
          ),
          h("div", { className: "dc-models-grid" },
            MODELS.map((m) =>
              h("div", { key: m.id, className: "dc-model-card" },
                h("div", { className: "dc-model-name" }, m.name),
                h("div", { className: "dc-model-meta" },
                  h("span", null, `Контекст: ${m.ctx}`),
                  h("span", null, `Вывод: ${m.out}`),
                  m.vision ? h("span", { style: { color: "#2ed573" } }, "📷 Vision") : null
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
