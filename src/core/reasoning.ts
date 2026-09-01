export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]
export type ReasoningEfforts = false | Partial<Record<ThinkingLevel, string | null>>
export type InputModality = 'text' | 'image'
export type ModelInput = readonly InputModality[]
export type InputMode = 'inherit' | 'text' | 'text-image' | 'custom'

export interface ModelProfile {
  readonly id: string
  readonly name?: string
  readonly input?: ModelInput
  readonly reasoningEfforts?: ReasoningEfforts
  readonly [key: string]: unknown
}

export interface ModelOverride {
  readonly name?: string
  readonly input?: ModelInput
  readonly reasoningEfforts?: ReasoningEfforts
  readonly [key: string]: unknown
}

export interface ProviderProfile {
  readonly displayName?: string
  readonly models?: readonly ModelProfile[]
  readonly modelOverrides?: Readonly<Record<string, ModelOverride>>
  readonly [key: string]: unknown
}

export interface PiAiSection {
  readonly providers?: Readonly<Record<string, ProviderProfile>>
  readonly [key: string]: unknown
}

export interface ReasoningModelRow {
  readonly providerId: string
  readonly providerName: string
  readonly modelId: string
  readonly modelName: string
  readonly source: 'model' | 'override'
  readonly modelIndex?: number
  readonly models?: readonly ModelProfile[]
  readonly efforts?: ReasoningEfforts
  readonly input?: ModelInput
}

export interface SettingsPathOperation {
  readonly op: 'set' | 'unset'
  readonly path: readonly string[]
  readonly value?: unknown
}

/** 返回 Codex/OpenAI 常用推理等级映射的新副本。 */
export function codexReasoningTemplate(): Exclude<ReasoningEfforts, false> {
  return {
    off: null,
    minimal: 'low',
    low: 'low',
    medium: 'medium',
    high: 'high',
    xhigh: 'xhigh',
  }
}

/**
 * 将生效的 pi-ai 配置投影为可编辑的逐模型列表。
 * @param section `llm-pi-ai` 命名空间的生效值。
 */
export function listReasoningModels(section: PiAiSection | undefined): ReasoningModelRow[] {
  const providers = section?.providers ?? {}
  const rows: ReasoningModelRow[] = []

  for (const [providerId, profile] of Object.entries(providers)) {
    const providerName = profile.displayName?.trim() || providerId
    const seen = new Set<string>()
    const models = profile.models ?? []

    for (const [modelIndex, model] of models.entries()) {
      if (!model.id || seen.has(model.id)) continue
      seen.add(model.id)
      const override = profile.modelOverrides?.[model.id]
      rows.push({
        providerId,
        providerName,
        modelId: model.id,
        modelName: override?.name?.trim() || model.name?.trim() || model.id,
        source: 'model',
        modelIndex,
        models,
        ...(override?.reasoningEfforts !== undefined
          ? { efforts: override.reasoningEfforts }
          : model.reasoningEfforts !== undefined
            ? { efforts: model.reasoningEfforts }
            : {}),
        ...(override?.input !== undefined
          ? { input: override.input }
          : model.input !== undefined
            ? { input: model.input }
            : {}),
      })
    }

    for (const [modelId, override] of Object.entries(profile.modelOverrides ?? {})) {
      if (seen.has(modelId)) continue
      rows.push({
        providerId,
        providerName,
        modelId,
        modelName: override.name?.trim() || modelId,
        source: 'override',
        ...(override.reasoningEfforts === undefined ? {} : { efforts: override.reasoningEfforts }),
        ...(override.input === undefined ? {} : { input: override.input }),
      })
    }
  }

  return rows.sort((left, right) =>
    left.providerName.localeCompare(right.providerName) || left.modelName.localeCompare(right.modelName),
  )
}

/**
 * 将输入模式转换为 DSH 模型配置；自定义历史值在未重选时原样保留。
 * @param mode 表单选择的输入能力模式。
 * @param current 当前模型显式输入能力，仅供自定义模式无损往返。
 */
export function inputFromMode(mode: InputMode, current?: ModelInput): ModelInput | undefined {
  if (mode === 'inherit') return undefined
  if (mode === 'custom') return current
  return mode === 'text-image' ? ['text', 'image'] : ['text']
}

/**
 * 将模型配置转换为输入能力模式；合法但非标准组合标记为自定义并原样保留。
 * @param input 模型当前显式输入能力。
 */
export function inputModeOf(input: ModelInput | undefined): InputMode {
  if (input === undefined) return 'inherit'
  if (input.length === 1 && input[0] === 'text') return 'text'
  if (input.length === 2 && input[0] === 'text' && input[1] === 'image') return 'text-image'
  return 'custom'
}

/**
 * 生成模型推理等级与输入能力的原子安全写入。
 * @param row 要修改的模型。
 * @param efforts 新推理配置；`undefined` 表示恢复适配器默认。
 * @param input 新输入能力；`undefined` 表示继承默认。
 */
export function modelCapabilityMutations(
  row: ReasoningModelRow,
  efforts: ReasoningEfforts | undefined,
  input: ModelInput | undefined,
): SettingsPathOperation[] {
  if (row.source === 'model') {
    if (row.modelIndex === undefined || row.models === undefined) {
      throw new Error(`声明模型 ${row.providerId}/${row.modelId} 缺少目录位置`)
    }
    const models = row.models.map((model, index) => {
      if (index !== row.modelIndex) return model
      const { reasoningEfforts: _currentEfforts, input: _currentInput, ...rest } = model
      return {
        ...rest,
        ...(input === undefined ? {} : { input }),
        ...(efforts === undefined ? {} : { reasoningEfforts: efforts }),
      }
    })
    return [{ op: 'set', path: ['providers', row.providerId, 'models'], value: models }]
  }
  const root = ['providers', row.providerId, 'modelOverrides', row.modelId]
  return [
    efforts === undefined
      ? { op: 'unset', path: [...root, 'reasoningEfforts'] }
      : { op: 'set', path: [...root, 'reasoningEfforts'], value: efforts },
    input === undefined
      ? { op: 'unset', path: [...root, 'input'] }
      : { op: 'set', path: [...root, 'input'], value: input },
  ]
}

/**
 * 保留旧调用面的推理写入，用于兼容现有测试和外部导入。
 * @param row 要修改的模型。
 * @param efforts 新配置；`undefined` 表示恢复适配器默认。
 */
export function reasoningMutation(
  row: ReasoningModelRow,
  efforts: ReasoningEfforts | undefined,
): SettingsPathOperation {
  return modelCapabilityMutations(row, efforts, row.input)[0]!
}

/**
 * 校验并规范化表单映射，避免 Host 因空值或无推理档位拒绝整个命名空间。
 * @param enabled 当前启用的等级集合。
 * @param wireValues 每个等级实际发送给接口的值。
 */
export function normalizeReasoningEfforts(
  enabled: ReadonlySet<ThinkingLevel>,
  wireValues: Readonly<Partial<Record<ThinkingLevel, string>>>,
): Exclude<ReasoningEfforts, false> {
  const result: Partial<Record<ThinkingLevel, string | null>> = {}
  for (const level of THINKING_LEVELS) {
    if (!enabled.has(level)) continue
    if (level === 'off') {
      result.off = wireValues.off?.trim() || null
      continue
    }
    const wire = wireValues[level]?.trim()
    if (!wire) throw new Error(`${level} 需要填写发送值`)
    result[level] = wire
  }
  if (!THINKING_LEVELS.some(level => level !== 'off' && result[level] !== undefined)) {
    throw new Error('至少启用一个非关闭推理等级')
  }
  return result
}
