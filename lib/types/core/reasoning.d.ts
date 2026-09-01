export declare const THINKING_LEVELS: readonly ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type ReasoningEfforts = false | Partial<Record<ThinkingLevel, string | null>>;
export type InputModality = 'text' | 'image';
export type ModelInput = readonly InputModality[];
export type InputMode = 'inherit' | 'text' | 'text-image' | 'custom';
export interface ModelProfile {
    readonly id: string;
    readonly name?: string;
    readonly input?: ModelInput;
    readonly reasoningEfforts?: ReasoningEfforts;
    readonly [key: string]: unknown;
}
export interface ModelOverride {
    readonly name?: string;
    readonly input?: ModelInput;
    readonly reasoningEfforts?: ReasoningEfforts;
    readonly [key: string]: unknown;
}
export interface ProviderProfile {
    readonly displayName?: string;
    readonly models?: readonly ModelProfile[];
    readonly modelOverrides?: Readonly<Record<string, ModelOverride>>;
    readonly [key: string]: unknown;
}
export interface PiAiSection {
    readonly providers?: Readonly<Record<string, ProviderProfile>>;
    readonly [key: string]: unknown;
}
export interface ReasoningModelRow {
    readonly providerId: string;
    readonly providerName: string;
    readonly modelId: string;
    readonly modelName: string;
    readonly source: 'model' | 'override';
    readonly modelIndex?: number;
    readonly models?: readonly ModelProfile[];
    readonly efforts?: ReasoningEfforts;
    readonly input?: ModelInput;
}
export interface SettingsPathOperation {
    readonly op: 'set' | 'unset';
    readonly path: readonly string[];
    readonly value?: unknown;
}
/** 返回 Codex/OpenAI 常用推理等级映射的新副本。 */
export declare function codexReasoningTemplate(): Exclude<ReasoningEfforts, false>;
/**
 * 将生效的 pi-ai 配置投影为可编辑的逐模型列表。
 * @param section `llm-pi-ai` 命名空间的生效值。
 */
export declare function listReasoningModels(section: PiAiSection | undefined): ReasoningModelRow[];
/**
 * 将输入模式转换为 DSH 模型配置；自定义历史值在未重选时原样保留。
 * @param mode 表单选择的输入能力模式。
 * @param current 当前模型显式输入能力，仅供自定义模式无损往返。
 */
export declare function inputFromMode(mode: InputMode, current?: ModelInput): ModelInput | undefined;
/**
 * 将模型配置转换为输入能力模式；合法但非标准组合标记为自定义并原样保留。
 * @param input 模型当前显式输入能力。
 */
export declare function inputModeOf(input: ModelInput | undefined): InputMode;
/**
 * 生成模型推理等级与输入能力的原子安全写入。
 * @param row 要修改的模型。
 * @param efforts 新推理配置；`undefined` 表示恢复适配器默认。
 * @param input 新输入能力；`undefined` 表示继承默认。
 */
export declare function modelCapabilityMutations(row: ReasoningModelRow, efforts: ReasoningEfforts | undefined, input: ModelInput | undefined): SettingsPathOperation[];
/**
 * 保留旧调用面的推理写入，用于兼容现有测试和外部导入。
 * @param row 要修改的模型。
 * @param efforts 新配置；`undefined` 表示恢复适配器默认。
 */
export declare function reasoningMutation(row: ReasoningModelRow, efforts: ReasoningEfforts | undefined): SettingsPathOperation;
/**
 * 校验并规范化表单映射，避免 Host 因空值或无推理档位拒绝整个命名空间。
 * @param enabled 当前启用的等级集合。
 * @param wireValues 每个等级实际发送给接口的值。
 */
export declare function normalizeReasoningEfforts(enabled: ReadonlySet<ThinkingLevel>, wireValues: Readonly<Partial<Record<ThinkingLevel, string>>>): Exclude<ReasoningEfforts, false>;
