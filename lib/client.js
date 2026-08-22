window.__ModuleLoader__.load({
	id: "dsh-reasoning-efforts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/core/reasoning.ts
		const THINKING_LEVELS = [
			"off",
			"minimal",
			"low",
			"medium",
			"high",
			"xhigh",
			"max"
		];
		/** 返回 Codex/OpenAI 常用推理等级映射的新副本。 */
		function codexReasoningTemplate() {
			return {
				off: null,
				minimal: "low",
				low: "low",
				medium: "medium",
				high: "high",
				xhigh: "xhigh"
			};
		}
		/**
		* 将生效的 pi-ai 配置投影为可编辑的逐模型列表。
		* @param section `llm-pi-ai` 命名空间的生效值。
		*/
		function listReasoningModels(section) {
			const providers = section?.providers ?? {};
			const rows = [];
			for (const [providerId, profile] of Object.entries(providers)) {
				const providerName = profile.displayName?.trim() || providerId;
				const seen = /* @__PURE__ */ new Set();
				const models = profile.models ?? [];
				for (const [modelIndex, model] of models.entries()) {
					if (!model.id || seen.has(model.id)) continue;
					seen.add(model.id);
					const override = profile.modelOverrides?.[model.id];
					rows.push({
						providerId,
						providerName,
						modelId: model.id,
						modelName: override?.name?.trim() || model.name?.trim() || model.id,
						source: "model",
						modelIndex,
						models,
						...override?.reasoningEfforts !== void 0 ? { efforts: override.reasoningEfforts } : model.reasoningEfforts !== void 0 ? { efforts: model.reasoningEfforts } : {}
					});
				}
				for (const [modelId, override] of Object.entries(profile.modelOverrides ?? {})) {
					if (seen.has(modelId)) continue;
					rows.push({
						providerId,
						providerName,
						modelId,
						modelName: override.name?.trim() || modelId,
						source: "override",
						...override.reasoningEfforts === void 0 ? {} : { efforts: override.reasoningEfforts }
					});
				}
			}
			return rows.sort((left, right) => left.providerName.localeCompare(right.providerName) || left.modelName.localeCompare(right.modelName));
		}
		/**
		* 生成模型推理能力的最小安全写入；声明模型需整体保留并写回 `models` 数组。
		* @param row 要修改的模型。
		* @param efforts 新配置；`undefined` 表示恢复适配器默认。
		*/
		function reasoningMutation(row, efforts) {
			if (row.source === "model") {
				if (row.modelIndex === void 0 || row.models === void 0) throw new Error(`声明模型 ${row.providerId}/${row.modelId} 缺少目录位置`);
				const models = row.models.map((model, index) => {
					if (index !== row.modelIndex) return model;
					const { reasoningEfforts: _current, ...rest } = model;
					return efforts === void 0 ? rest : {
						...rest,
						reasoningEfforts: efforts
					};
				});
				return {
					op: "set",
					path: [
						"providers",
						row.providerId,
						"models"
					],
					value: models
				};
			}
			const path = [
				"providers",
				row.providerId,
				"modelOverrides",
				row.modelId,
				"reasoningEfforts"
			];
			return efforts === void 0 ? {
				op: "unset",
				path
			} : {
				op: "set",
				path,
				value: efforts
			};
		}
		/**
		* 校验并规范化表单映射，避免 Host 因空值或无推理档位拒绝整个命名空间。
		* @param enabled 当前启用的等级集合。
		* @param wireValues 每个等级实际发送给接口的值。
		*/
		function normalizeReasoningEfforts(enabled, wireValues) {
			const result = {};
			for (const level of THINKING_LEVELS) {
				if (!enabled.has(level)) continue;
				if (level === "off") {
					result.off = wireValues.off?.trim() || null;
					continue;
				}
				const wire = wireValues[level]?.trim();
				if (!wire) throw new Error(`${level} 需要填写发送值`);
				result[level] = wire;
			}
			if (!THINKING_LEVELS.some((level) => level !== "off" && result[level] !== void 0)) throw new Error("至少启用一个非关闭推理等级");
			return result;
		}
		//#endregion
		//#region src/client/ReasoningSettingsSection.tsx
		/** 将已有配置转换为可编辑表单；继承和不支持状态以 Codex 模板作为起点。 */
		function draftFrom(efforts) {
			const mapping = efforts === void 0 || efforts === false ? codexReasoningTemplate() : efforts;
			return {
				enabled: new Set(THINKING_LEVELS.filter((level) => mapping[level] !== void 0)),
				values: Object.fromEntries(THINKING_LEVELS.map((level) => [level, mapping[level] ?? ""]))
			};
		}
		/** 返回用户可读的错误消息。 */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** 返回模型当前推理能力状态对应的本地化键。 */
		function statusKey(efforts) {
			if (efforts === false) return "unsupported";
			return efforts === void 0 ? "inherited" : "configured";
		}
		/** 推理等级设置页，负责读取、编辑并以 revision 保护方式写回 llm-pi-ai。 */
		function ReasoningSettingsSection({ api, t }) {
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const [failure, setFailure] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)(() => draftFrom(void 0));
			const [saving, setSaving] = (0, react.useState)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			/** 从 Host 获取最新设置描述，并投影模型列表。 */
			const load = (0, react.useCallback)(async () => {
				setFailure(null);
				try {
					const response = await api.settings.describe({});
					if (!response.result.ok) throw new Error(response.result.error.message);
					const namespace = response.result.value.namespaces.find((item) => item.ns === "llm-pi-ai");
					if (!namespace) throw new Error("llm-pi-ai namespace is unavailable");
					setSnapshot({
						writable: response.result.value.writable,
						revision: namespace.revision,
						rows: listReasoningModels(namespace.value)
					});
				} catch (error) {
					setFailure(messageOf(error));
				}
			}, [api]);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			/** 打开模型编辑器并采用当前配置。 */
			const openEditor = (0, react.useCallback)((row) => {
				setSelected(row);
				setDraft(draftFrom(row.efforts));
				setFailure(null);
				setNotice(null);
			}, []);
			/** 保存一个模型的覆盖；undefined 表示取消覆盖。 */
			const saveEfforts = (0, react.useCallback)(async (efforts) => {
				if (!selected || !snapshot) return;
				setSaving(true);
				setFailure(null);
				try {
					const response = await api.settings.mutate({
						ns: "llm-pi-ai",
						ops: [reasoningMutation(selected, efforts)],
						expectedRevision: snapshot.revision
					});
					if (!response.result.ok) throw new Error(response.result.error.code === "settings-conflict" ? t("conflict") : response.result.error.message);
					setSelected(null);
					setNotice(t("saved", { model: selected.modelName }));
					await load();
				} catch (error) {
					setFailure(messageOf(error));
				} finally {
					setSaving(false);
				}
			}, [
				api,
				load,
				selected,
				snapshot,
				t
			]);
			/** 校验自定义表单并提交映射。 */
			const saveCustom = (0, react.useCallback)(() => {
				try {
					saveEfforts(normalizeReasoningEfforts(draft.enabled, draft.values));
				} catch (error) {
					setFailure(messageOf(error));
				}
			}, [draft, saveEfforts]);
			const groupedRows = (0, react.useMemo)(() => {
				const groups = /* @__PURE__ */ new Map();
				for (const row of snapshot?.rows ?? []) {
					const key = `${row.providerId}\u0000${row.providerName}`;
					groups.set(key, [...groups.get(key) ?? [], row]);
				}
				return [...groups.entries()];
			}, [snapshot]);
			if (!snapshot && !failure) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dreState",
				children: t("loading")
			});
			if (!snapshot) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dreState dreError",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("loadFailed") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: failure }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void load(),
						children: t("retry")
					})
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dreSection",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "dreHeader",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("title") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("intro") })]
					}),
					!snapshot.writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dreBanner",
						children: t("readOnly")
					}),
					notice && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dreNotice",
						role: "status",
						children: notice
					}),
					failure && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dreBanner dreError",
						role: "alert",
						children: failure
					}),
					snapshot.rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dreState",
						children: t("empty")
					}) : groupedRows.map(([key, rows]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dreProvider",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dreProviderTitle",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: rows[0].providerName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: rows[0].providerId })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dreModels",
							children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dreModel",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: row.modelName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: row.modelId })] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `dreStatus dreStatus-${statusKey(row.efforts)}`,
										children: t(statusKey(row.efforts))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: !snapshot.writable,
										onClick: () => openEditor(row),
										children: t("edit")
									})
								]
							}, `${row.providerId}:${row.modelId}`))
						})]
					}, key)),
					selected && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dreOverlay",
						role: "dialog",
						"aria-modal": "true",
						"aria-label": `${t("edit")} ${selected.modelName}`,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							className: "dreMask",
							type: "button",
							"aria-label": t("cancel"),
							onClick: () => setSelected(null)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dreDialog",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dreDialogHeader",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: selected.modelName }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("code", { children: [
										selected.providerId,
										" / ",
										selected.modelId
									] })] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setSelected(null),
										children: "×"
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "drePresets",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: saving,
											onClick: () => {
												const template = codexReasoningTemplate();
												setDraft(draftFrom(template));
											},
											children: t("codexTemplate")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: saving,
											onClick: () => void saveEfforts(false),
											children: t("disable")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: saving,
											onClick: () => void saveEfforts(void 0),
											children: t("restore")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dreMappingHeader",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("enabled") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("level") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("wireValue") })
									]
								}),
								THINKING_LEVELS.map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dreMapping",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: draft.enabled.has(level),
											onChange: (event) => {
												const enabled = new Set(draft.enabled);
												event.target.checked ? enabled.add(level) : enabled.delete(level);
												setDraft((current) => ({
													...current,
													enabled
												}));
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: level }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "text",
											disabled: !draft.enabled.has(level),
											value: draft.values[level] ?? "",
											placeholder: level === "off" ? t("offHint") : level,
											onChange: (event) => setDraft((current) => ({
												...current,
												values: {
													...current.values,
													[level]: event.target.value
												}
											}))
										})
									]
								}, level)),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dreHint",
									children: t("offHint")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dreActions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: saving,
										onClick: () => setSelected(null),
										children: t("cancel")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										className: "drePrimary",
										type: "button",
										disabled: saving,
										onClick: saveCustom,
										children: saving ? t("saving") : t("save")
									})]
								})
							]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			nav: "推理等级",
			title: "模型推理等级",
			intro: "按模型配置 DSH 可选等级与接口实际接收的值。保存内容写入 modelOverrides，不会复制或替换模型目录。",
			loading: "正在读取模型配置…",
			empty: "当前 llm-pi-ai 配置中没有可编辑模型。",
			loadFailed: "加载模型配置失败",
			readOnly: "当前设置文档为只读。",
			retry: "重试",
			edit: "配置",
			configured: "已自定义",
			inherited: "使用适配器默认",
			unsupported: "不支持推理",
			codexTemplate: "使用 Codex 模板",
			custom: "自定义映射",
			disable: "标记为不支持",
			restore: "恢复适配器默认",
			cancel: "取消",
			save: "保存",
			saving: "保存中…",
			enabled: "启用",
			level: "DSH 等级",
			wireValue: "接口发送值",
			offHint: "关闭档位可留空，表示不发送推理参数。",
			conflict: "设置已在其他位置发生变化，请重新加载后再编辑。",
			saved: "已保存 {model} 的推理等级。"
		};
		const en = {
			nav: "Reasoning",
			title: "Model reasoning efforts",
			intro: "Configure selectable DSH levels and provider wire values per model. Changes use modelOverrides and do not replace the model catalog.",
			loading: "Loading model configuration…",
			empty: "No editable model exists in the current llm-pi-ai configuration.",
			loadFailed: "Failed to load model configuration",
			readOnly: "The settings document is read-only.",
			retry: "Retry",
			edit: "Configure",
			configured: "Customized",
			inherited: "Adapter default",
			unsupported: "Reasoning unsupported",
			codexTemplate: "Use Codex template",
			custom: "Custom mapping",
			disable: "Mark unsupported",
			restore: "Restore adapter default",
			cancel: "Cancel",
			save: "Save",
			saving: "Saving…",
			enabled: "Enabled",
			level: "DSH level",
			wireValue: "Wire value",
			offHint: "The off value may be empty to omit the reasoning parameter.",
			conflict: "Settings changed elsewhere. Reload before editing again.",
			saved: "Saved reasoning efforts for {model}."
		};
		//#endregion
		//#region src/client/styles.css?inline
		var styles_default = ".dreSection, .dreSection * {\n  box-sizing: border-box;\n}\n\n.dreSection {\n  color: var(--dsw-alias-label-primary);\n  flex-direction: column;\n  gap: 16px;\n  max-width: 920px;\n  display: flex;\n}\n\n.dreHeader h2 {\n  margin: 0 0 6px;\n  font-size: 20px;\n}\n\n.dreHeader p {\n  color: var(--dsw-alias-label-secondary);\n  margin: 0;\n  font-size: 13px;\n  line-height: 1.6;\n}\n\n.dreBanner, .dreNotice, .dreState {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 10px;\n  padding: 12px 14px;\n}\n\n.dreNotice {\n  color: var(--dsw-alias-positive-label);\n}\n\n.dreError {\n  color: var(--dsw-alias-negative-label);\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dreProvider {\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  overflow: hidden;\n}\n\n.dreProviderTitle {\n  background: var(--dsw-alias-bg-elevated);\n  align-items: center;\n  gap: 10px;\n  padding: 12px 14px;\n  display: flex;\n}\n\n.dreProviderTitle code, .dreModel code, .dreDialogHeader code {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n}\n\n.dreModels {\n  flex-direction: column;\n  display: flex;\n}\n\n.dreModel {\n  border-top: 1px solid var(--dsw-alias-border-l1);\n  grid-template-columns: minmax(0, 1fr) auto auto;\n  align-items: center;\n  gap: 12px;\n  padding: 12px 14px;\n  display: grid;\n}\n\n.dreModel:first-child {\n  border-top: 0;\n}\n\n.dreModel > div {\n  flex-direction: column;\n  gap: 3px;\n  min-width: 0;\n  display: flex;\n}\n\n.dreModel button, .drePresets button, .dreActions button, .dreState button, .dreDialogHeader button {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l2);\n  color: inherit;\n  cursor: pointer;\n  border-radius: 8px;\n  padding: 7px 11px;\n}\n\n.dreModel button:disabled, .drePresets button:disabled, .dreActions button:disabled {\n  cursor: not-allowed;\n  opacity: .5;\n}\n\n.dreStatus {\n  border-radius: 999px;\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n.dreStatus-configured {\n  background: color-mix(in srgb,var(--dsw-alias-positive-label) 14%,transparent);\n  color: var(--dsw-alias-positive-label);\n}\n\n.dreStatus-inherited {\n  background: var(--dsw-alias-bg-elevated);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dreStatus-unsupported {\n  background: color-mix(in srgb,var(--dsw-alias-negative-label) 12%,transparent);\n  color: var(--dsw-alias-negative-label);\n}\n\n.dreOverlay {\n  z-index: 2147482000;\n  justify-content: center;\n  align-items: center;\n  padding: 24px;\n  display: flex;\n  position: fixed;\n  inset: 0;\n}\n\n.dreMask {\n  background: #05070c99;\n  border: 0;\n  position: absolute;\n  inset: 0;\n}\n\n.dreDialog {\n  background: var(--dsw-alias-bg-base);\n  border: 1px solid var(--dsw-alias-border-l2);\n  box-shadow: var(--dsw-shadow-lv4);\n  border-radius: 14px;\n  flex-direction: column;\n  gap: 14px;\n  width: 100%;\n  max-width: 680px;\n  max-height: calc(100vh - 48px);\n  padding: 18px;\n  display: flex;\n  position: relative;\n  overflow: auto;\n}\n\n.dreDialogHeader {\n  justify-content: space-between;\n  align-items: center;\n  display: flex;\n}\n\n.dreDialogHeader > div {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.dreDialogHeader button {\n  padding: 5px 9px;\n  font-size: 20px;\n  line-height: 1;\n}\n\n.drePresets {\n  flex-wrap: wrap;\n  gap: 8px;\n  display: flex;\n}\n\n.dreMappingHeader, .dreMapping {\n  grid-template-columns: 54px 100px minmax(0, 1fr);\n  align-items: center;\n  gap: 10px;\n  display: grid;\n}\n\n.dreMappingHeader {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.dreMapping {\n  border-top: 1px solid var(--dsw-alias-border-l1);\n  padding-top: 9px;\n}\n\n.dreMapping input[type=\"text\"] {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l2);\n  color: inherit;\n  border-radius: 7px;\n  width: 100%;\n  min-width: 0;\n  padding: 8px 10px;\n}\n\n.dreMapping input[type=\"text\"]:disabled {\n  opacity: .45;\n}\n\n.dreHint {\n  color: var(--dsw-alias-label-tertiary);\n  margin: 0;\n  font-size: 12px;\n}\n\n.dreActions {\n  justify-content: flex-end;\n  gap: 8px;\n  display: flex;\n}\n\n.dreActions .drePrimary {\n  background: var(--dsw-alias-interactive-bg-primary);\n  color: var(--dsw-alias-interactive-label-primary);\n}\n\n@media (width <= 640px) {\n  .dreModel {\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .dreStatus {\n    grid-column: 1;\n  }\n\n  .dreMappingHeader, .dreMapping {\n    grid-template-columns: 44px 70px minmax(0, 1fr);\n  }\n}\n";
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote"
		];
		const NS = "settings.reasoningEfforts";
		/** 注册推理等级设置页、词典和配置更新监听。 */
		function apply(ctx) {
			ctx.effect(() => {
				const style = document.createElement("style");
				style.dataset.dshReasoningEfforts = "";
				style.textContent = styles_default;
				document.head.appendChild(style);
				return () => style.remove();
			}, "dsh-reasoning-efforts: styles");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-reasoning-efforts: dictionaries");
			const connection = ctx.get("connection");
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				api: connection.api,
				t
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "reasoning-efforts",
				order: 20,
				label: () => t("nav"),
				inject: injected
			}, ReasoningSettingsSection));
		}
		//#endregion
		exports.ReasoningSettingsSection = ReasoningSettingsSection;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map