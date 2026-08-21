export declare const THINKING_LEVELS: readonly ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type ReasoningEfforts = false | Partial<Record<ThinkingLevel, string | null>>;
export interface ModelProfile {
    readonly id: string;
    readonly name?: string;
    readonly reasoningEfforts?: ReasoningEfforts;
    readonly [key: string]: unknown;
}
export interface ModelOverride {
    readonly name?: string;
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
    readonly efforts?: ReasoningEfforts;
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
 * 生成仅覆盖模型推理能力的路径操作，避免复制整个模型目录。
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
