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
						...override?.reasoningEfforts !== void 0 ? { efforts: override.reasoningEfforts } : model.reasoningEfforts !== void 0 ? { efforts: model.reasoningEfforts } : {},
						...override?.input !== void 0 ? { input: override.input } : model.input !== void 0 ? { input: model.input } : {}
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
						...override.reasoningEfforts === void 0 ? {} : { efforts: override.reasoningEfforts },
						...override.input === void 0 ? {} : { input: override.input }
					});
				}
			}
			return rows.sort((left, right) => left.providerName.localeCompare(right.providerName) || left.modelName.localeCompare(right.modelName));
		}
		/**
		* 将输入模式转换为 DSH 模型配置；自定义历史值在未重选时原样保留。
		* @param mode 表单选择的输入能力模式。
		* @param current 当前模型显式输入能力，仅供自定义模式无损往返。
		*/
		function inputFromMode(mode, current) {
			if (mode === "inherit") return void 0;
			if (mode === "custom") return current;
			return mode === "text-image" ? ["text", "image"] : ["text"];
		}
		/**
		* 将模型配置转换为输入能力模式；合法但非标准组合标记为自定义并原样保留。
		* @param input 模型当前显式输入能力。
		*/
		function inputModeOf(input) {
			if (input === void 0) return "inherit";
			if (input.length === 1 && input[0] === "text") return "text";
			if (input.length === 2 && input[0] === "text" && input[1] === "image") return "text-image";
			return "custom";
		}
		/**
		* 生成模型推理等级与输入能力的原子安全写入。
		* @param row 要修改的模型。
		* @param efforts 新推理配置；`undefined` 表示恢复适配器默认。
		* @param input 新输入能力；`undefined` 表示继承默认。
		*/
		function modelCapabilityMutations(row, efforts, input) {
			if (row.source === "model") {
				if (row.modelIndex === void 0 || row.models === void 0) throw new Error(`声明模型 ${row.providerId}/${row.modelId} 缺少目录位置`);
				const models = row.models.map((model, index) => {
					if (index !== row.modelIndex) return model;
					const { reasoningEfforts: _currentEfforts, input: _currentInput, ...rest } = model;
					return {
						...rest,
						...input === void 0 ? {} : { input },
						...efforts === void 0 ? {} : { reasoningEfforts: efforts }
					};
				});
				return [{
					op: "set",
					path: [
						"providers",
						row.providerId,
						"models"
					],
					value: models
				}];
			}
			const root = [
				"providers",
				row.providerId,
				"modelOverrides",
				row.modelId
			];
			return [efforts === void 0 ? {
				op: "unset",
				path: [...root, "reasoningEfforts"]
			} : {
				op: "set",
				path: [...root, "reasoningEfforts"],
				value: efforts
			}, input === void 0 ? {
				op: "unset",
				path: [...root, "input"]
			} : {
				op: "set",
				path: [...root, "input"],
				value: input
			}];
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
		/** 将已有配置转换为可编辑表单，并保留继承与不支持两种独立状态。 */
		function draftFrom(row) {
			const mapping = row.efforts === void 0 || row.efforts === false ? codexReasoningTemplate() : row.efforts;
			return {
				reasoningMode: row.efforts === void 0 ? "inherit" : row.efforts === false ? "unsupported" : "custom",
				enabled: new Set(THINKING_LEVELS.filter((level) => mapping[level] !== void 0)),
				values: Object.fromEntries(THINKING_LEVELS.map((level) => [level, mapping[level] ?? ""])),
				inputMode: inputModeOf(row.input)
			};
		}
		/** 返回用户可读的错误消息。 */
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** 返回模型当前推理能力状态对应的本地化键。 */
		function reasoningStatusKey(efforts) {
			if (efforts === false) return "unsupported";
			return efforts === void 0 ? "inherited" : "configured";
		}
		/** 返回模型当前显式输入能力对应的本地化键。 */
		function inputStatusKey(row) {
			const mode = inputModeOf(row.input);
			if (mode === "text-image") return "inputTextImage";
			if (mode === "text") return "inputText";
			if (mode === "custom") return "inputCustom";
			return "inputInherited";
		}
		/** 将表单的推理状态转换为写入值，并校验自定义映射。 */
		function effortsFromDraft(draft) {
			if (draft.reasoningMode === "inherit") return void 0;
			if (draft.reasoningMode === "unsupported") return false;
			return normalizeReasoningEfforts(draft.enabled, draft.values);
		}
		/** 推理等级设置页，负责读取、编辑并以 revision 保护方式原子写回模型能力。 */
		function ReasoningSettingsSection({ api, t }) {
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const [failure, setFailure] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)(() => draftFrom({}));
			const [saving, setSaving] = (0, react.useState)(false);
			const savingRef = (0, react.useRef)(false);
			const [notice, setNotice] = (0, react.useState)(null);
			/** 从 Host 获取最新设置描述，并投影模型列表。 */
			const load = (0, react.useCallback)(async () => {
				setFailure(null);
				try {
					const response = await api.settings.describe();
					if (!response.ok) throw new Error(response.error.message);
					const namespace = response.value.namespaces.find((item) => item.ns === "llm-pi-ai");
					if (!namespace) throw new Error("llm-pi-ai namespace is unavailable");
					setSnapshot({
						writable: response.value.writable,
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
			/** 打开模型编辑器并采用当前推理与输入能力配置。 */
			const openEditor = (0, react.useCallback)((row) => {
				setSelected(row);
				setDraft(draftFrom(row));
				setFailure(null);
				setNotice(null);
			}, []);
			/** 校验并原子保存一个模型的推理等级与输入能力。 */
			const saveCapabilities = (0, react.useCallback)(async () => {
				if (!selected || !snapshot || savingRef.current) return;
				savingRef.current = true;
				setSaving(true);
				setFailure(null);
				try {
					const response = await api.settings.mutate("llm-pi-ai", modelCapabilityMutations(selected, effortsFromDraft(draft), inputFromMode(draft.inputMode, selected.input)), snapshot.revision);
					if (!response.ok) throw new Error(response.error.code === "settings-conflict" ? t("conflict") : response.error.message);
					setSelected(null);
					setNotice(t("saved", { model: selected.modelName }));
					await load();
				} catch (error) {
					setFailure(messageOf(error));
				} finally {
					savingRef.current = false;
					setSaving(false);
				}
			}, [
				api,
				draft,
				load,
				selected,
				snapshot,
				t
			]);
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
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dreModelIdentity",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: row.modelName }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: row.modelId })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dreStatuses",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `dreStatus dreStatus-${reasoningStatusKey(row.efforts)}`,
											children: t(reasoningStatusKey(row.efforts))
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `dreStatus dreStatus-${inputModeOf(row.input)}`,
											children: t(inputStatusKey(row))
										})]
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
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "dreCapabilityBlock",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("reasoningTitle") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "drePresets",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													disabled: saving,
													onClick: () => setDraft((current) => ({
														...draftFrom({ efforts: codexReasoningTemplate() }),
														inputMode: current.inputMode
													})),
													children: t("codexTemplate")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													disabled: saving,
													onClick: () => setDraft((current) => ({
														...current,
														reasoningMode: "unsupported"
													})),
													children: t("disable")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													disabled: saving,
													onClick: () => setDraft((current) => ({
														...current,
														reasoningMode: "inherit"
													})),
													children: t("restore")
												})
											]
										}),
										draft.reasoningMode === "custom" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
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
																enabled,
																reasoningMode: "custom"
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
															reasoningMode: "custom",
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
											})
										] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dreModeNotice",
											children: t(draft.reasoningMode === "inherit" ? "reasoningInheritNotice" : "reasoningUnsupportedNotice")
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
									className: "dreCapabilityBlock",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: t("inputTitle") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "dreHint",
											children: t("inputHint")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dreInputModes",
											children: [
												...draft.inputMode === "custom" ? ["custom"] : [],
												"inherit",
												"text",
												"text-image"
											].map((mode) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: "input-mode",
												value: mode,
												checked: draft.inputMode === mode,
												disabled: mode === "custom",
												onChange: () => setDraft((current) => ({
													...current,
													inputMode: mode
												}))
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(mode === "custom" ? "inputCustomOption" : mode === "inherit" ? "inputInherit" : mode === "text" ? "inputTextOption" : "inputTextImageOption") }),
												mode === "custom" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("inputCustomHint") }),
												mode === "text-image" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("inputImageWarning") })
											] })] }, mode))
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											className: "dreInputPreview",
											children: draft.inputMode === "inherit" ? t("inputPreviewInherit") : `input: [${inputFromMode(draft.inputMode, selected.input).join(", ")}]`
										})
									]
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
										onClick: () => void saveCapabilities(),
										children: saving ? t("saving") : t("saveCapabilities")
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
			intro: "按模型配置 DSH 推理等级与输入能力，使用受 revision 保护的原子写入保留其他模型字段。",
			loading: "正在读取模型配置…",
			empty: "当前 llm-pi-ai 配置中没有可编辑模型。",
			loadFailed: "加载模型配置失败",
			readOnly: "当前设置文档为只读。",
			retry: "重试",
			edit: "配置",
			configured: "推理：已自定义",
			inherited: "推理：使用默认",
			unsupported: "推理：不支持",
			inputInherited: "输入：继承",
			inputText: "输入：仅文本",
			inputTextImage: "输入：文本 + 图片",
			inputCustom: "输入：自定义",
			reasoningTitle: "推理等级",
			codexTemplate: "使用 Codex 模板",
			custom: "自定义映射",
			disable: "标记为不支持",
			restore: "恢复适配器默认",
			reasoningInheritNotice: "保存后删除模型级 reasoningEfforts，使用适配器默认能力。",
			reasoningUnsupportedNotice: "保存后将 reasoningEfforts 设为 false，模型不提供推理等级。",
			inputTitle: "输入能力",
			inputHint: "声明该模型可接收的内容类型。此设置不会检测模型或接口的实际上游能力。",
			inputInherit: "继承 Provider / 模型目录默认",
			inputCustomOption: "保留现有自定义组合",
			inputCustomHint: "这是合法但非标准的历史配置；未选择其他模式时将原样保留。",
			inputTextOption: "仅文本",
			inputTextImageOption: "文本与图片",
			inputImageWarning: "启用前请确认模型和接口实际支持图片输入。",
			inputPreviewInherit: "保存后删除模型级 input 字段",
			cancel: "取消",
			save: "保存",
			saveCapabilities: "保存配置",
			saving: "保存中…",
			enabled: "启用",
			level: "DSH 等级",
			wireValue: "接口发送值",
			offHint: "关闭档位可留空，表示不发送推理参数。",
			conflict: "设置已在其他位置发生变化，请重新加载后再编辑。",
			saved: "已保存 {model} 的推理等级与输入能力。"
		};
		const en = {
			nav: "Reasoning",
			title: "Model reasoning efforts",
			intro: "Configure DSH reasoning levels and input capabilities per model with revision-protected atomic writes that preserve other model fields.",
			loading: "Loading model configuration…",
			empty: "No editable model exists in the current llm-pi-ai configuration.",
			loadFailed: "Failed to load model configuration",
			readOnly: "The settings document is read-only.",
			retry: "Retry",
			edit: "Configure",
			configured: "Reasoning: customized",
			inherited: "Reasoning: default",
			unsupported: "Reasoning: unsupported",
			inputInherited: "Input: inherited",
			inputText: "Input: text only",
			inputTextImage: "Input: text + images",
			inputCustom: "Input: custom",
			reasoningTitle: "Reasoning efforts",
			codexTemplate: "Use Codex template",
			custom: "Custom mapping",
			disable: "Mark unsupported",
			restore: "Restore adapter default",
			reasoningInheritNotice: "Saving removes model-level reasoningEfforts and uses the adapter defaults.",
			reasoningUnsupportedNotice: "Saving sets reasoningEfforts to false so the model offers no reasoning levels.",
			inputTitle: "Input capabilities",
			inputHint: "Declare the content types this model accepts. This setting does not probe the model or upstream endpoint.",
			inputInherit: "Inherit provider / catalog defaults",
			inputCustomOption: "Keep existing custom combination",
			inputCustomHint: "This is a valid but non-standard existing value; it remains unchanged until another mode is selected.",
			inputTextOption: "Text only",
			inputTextImageOption: "Text and images",
			inputImageWarning: "Confirm that the model and endpoint actually support image input.",
			inputPreviewInherit: "Saving removes the model-level input field",
			cancel: "Cancel",
			save: "Save",
			saveCapabilities: "Save configuration",
			saving: "Saving…",
			enabled: "Enabled",
			level: "DSH level",
			wireValue: "Wire value",
			offHint: "The off value may be empty to omit the reasoning parameter.",
			conflict: "Settings changed elsewhere. Reload before editing again.",
			saved: "Saved reasoning efforts and input capabilities for {model}."
		};
		//#endregion
		//#region src/client/styles.css?inline
		var styles_default = ".dreSection, .dreSection * {\n  box-sizing: border-box;\n}\n\n.dreSection {\n  color: var(--dsw-alias-label-primary);\n  flex-direction: column;\n  gap: 16px;\n  max-width: 920px;\n  display: flex;\n}\n\n.dreHeader h2 {\n  margin: 0 0 6px;\n  font-size: 20px;\n}\n\n.dreHeader p {\n  color: var(--dsw-alias-label-secondary);\n  margin: 0;\n  font-size: 13px;\n  line-height: 1.6;\n}\n\n.dreBanner, .dreNotice, .dreState {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 10px;\n  padding: 12px 14px;\n}\n\n.dreNotice {\n  color: var(--dsw-alias-positive-label);\n}\n\n.dreError {\n  color: var(--dsw-alias-negative-label);\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dreProvider {\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  overflow: hidden;\n}\n\n.dreProviderTitle {\n  background: var(--dsw-alias-bg-elevated);\n  align-items: center;\n  gap: 10px;\n  padding: 12px 14px;\n  display: flex;\n}\n\n.dreProviderTitle code, .dreModel code, .dreDialogHeader code {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n}\n\n.dreModels {\n  flex-direction: column;\n  display: flex;\n}\n\n.dreModel {\n  border-top: 1px solid var(--dsw-alias-border-l1);\n  grid-template-columns: minmax(0, 1fr) auto auto;\n  align-items: center;\n  gap: 12px;\n  padding: 12px 14px;\n  display: grid;\n}\n\n.dreModel:first-child {\n  border-top: 0;\n}\n\n.dreModelIdentity {\n  flex-direction: column;\n  gap: 3px;\n  min-width: 0;\n  display: flex;\n}\n\n.dreStatuses {\n  flex-wrap: wrap;\n  justify-content: flex-end;\n  align-items: center;\n  gap: 6px;\n  display: flex;\n}\n\n.dreModel button, .drePresets button, .dreActions button, .dreState button, .dreDialogHeader button {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l2);\n  color: inherit;\n  cursor: pointer;\n  border-radius: 8px;\n  padding: 7px 11px;\n}\n\n.dreModel button:disabled, .drePresets button:disabled, .dreActions button:disabled {\n  cursor: not-allowed;\n  opacity: .5;\n}\n\n.dreStatus {\n  border-radius: 999px;\n  padding: 4px 8px;\n  font-size: 12px;\n}\n\n.dreStatus-configured, .dreStatus-text-image {\n  background: color-mix(in srgb,var(--dsw-alias-positive-label) 14%,transparent);\n  color: var(--dsw-alias-positive-label);\n}\n\n.dreStatus-inherited, .dreStatus-inherit, .dreStatus-text, .dreStatus-custom {\n  background: var(--dsw-alias-bg-elevated);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dreStatus-unsupported {\n  background: color-mix(in srgb,var(--dsw-alias-negative-label) 12%,transparent);\n  color: var(--dsw-alias-negative-label);\n}\n\n.dreOverlay {\n  z-index: 2147482000;\n  justify-content: center;\n  align-items: center;\n  padding: 24px;\n  display: flex;\n  position: fixed;\n  inset: 0;\n}\n\n.dreMask {\n  background: #05070c99;\n  border: 0;\n  position: absolute;\n  inset: 0;\n}\n\n.dreDialog {\n  background: var(--dsw-alias-bg-base);\n  border: 1px solid var(--dsw-alias-border-l2);\n  box-shadow: var(--dsw-shadow-lv4);\n  border-radius: 14px;\n  flex-direction: column;\n  gap: 16px;\n  width: 100%;\n  max-width: 680px;\n  max-height: calc(100vh - 48px);\n  padding: 18px;\n  display: flex;\n  position: relative;\n  overflow: auto;\n}\n\n.dreDialogHeader {\n  justify-content: space-between;\n  align-items: center;\n  display: flex;\n}\n\n.dreDialogHeader > div {\n  flex-direction: column;\n  gap: 4px;\n  display: flex;\n}\n\n.dreDialogHeader button {\n  padding: 5px 9px;\n  font-size: 20px;\n  line-height: 1;\n}\n\n.dreCapabilityBlock {\n  border-top: 1px solid var(--dsw-alias-border-l1);\n  flex-direction: column;\n  gap: 12px;\n  padding-top: 14px;\n  display: flex;\n}\n\n.dreCapabilityBlock h3 {\n  margin: 0;\n  font-size: 15px;\n}\n\n.drePresets {\n  flex-wrap: wrap;\n  gap: 8px;\n  display: flex;\n}\n\n.dreMappingHeader, .dreMapping {\n  grid-template-columns: 54px 100px minmax(0, 1fr);\n  align-items: center;\n  gap: 10px;\n  display: grid;\n}\n\n.dreMappingHeader {\n  color: var(--dsw-alias-label-secondary);\n  font-size: 12px;\n}\n\n.dreMapping {\n  border-top: 1px solid var(--dsw-alias-border-l1);\n  padding-top: 9px;\n}\n\n.dreMapping input[type=\"text\"] {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l2);\n  color: inherit;\n  border-radius: 7px;\n  width: 100%;\n  min-width: 0;\n  padding: 8px 10px;\n}\n\n.dreMapping input[type=\"text\"]:disabled {\n  opacity: .45;\n}\n\n.dreHint, .dreModeNotice {\n  color: var(--dsw-alias-label-tertiary);\n  margin: 0;\n  font-size: 12px;\n  line-height: 1.6;\n}\n\n.dreModeNotice {\n  background: var(--dsw-alias-bg-elevated);\n  border-radius: 8px;\n  padding: 10px 12px;\n}\n\n.dreInputModes {\n  flex-direction: column;\n  gap: 8px;\n  display: flex;\n}\n\n.dreInputModes label {\n  background: var(--dsw-alias-bg-elevated);\n  border: 1px solid var(--dsw-alias-border-l2);\n  cursor: pointer;\n  border-radius: 9px;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  display: flex;\n}\n\n.dreInputModes label:has(input:checked) {\n  border-color: var(--dsw-alias-positive-label);\n}\n\n.dreInputModes input {\n  margin-top: 3px;\n}\n\n.dreInputModes span {\n  flex-direction: column;\n  gap: 3px;\n  display: flex;\n}\n\n.dreInputModes small {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  font-weight: 400;\n}\n\n.dreInputPreview {\n  background: var(--dsw-alias-bg-elevated);\n  color: var(--dsw-alias-label-secondary);\n  border-radius: 7px;\n  padding: 8px 10px;\n  font-size: 12px;\n}\n\n.dreActions {\n  justify-content: flex-end;\n  gap: 8px;\n  display: flex;\n}\n\n.dreActions .drePrimary {\n  background: var(--dsw-alias-interactive-bg-primary);\n  color: var(--dsw-alias-interactive-label-primary);\n}\n\n@media (width <= 640px) {\n  .dreModel {\n    grid-template-columns: minmax(0, 1fr) auto;\n  }\n\n  .dreStatuses {\n    grid-column: 1;\n    justify-content: flex-start;\n  }\n\n  .dreMappingHeader, .dreMapping {\n    grid-template-columns: 44px 70px minmax(0, 1fr);\n  }\n}\n";
		//#endregion
		//#region src/client/index.ts
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.settings"
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
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				api: { settings: ctx.remote.settings },
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