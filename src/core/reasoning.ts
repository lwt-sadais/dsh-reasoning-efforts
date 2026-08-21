export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export type ThinkingLevel = (typeof THINKING_LEVELS)[number]
export type ReasoningEfforts = false | Partial<Record<ThinkingLevel, string | null>>

export interface ModelProfile {
  readonly id: string
  readonly name?: string
  readonly reasoningEfforts?: ReasoningEfforts
  readonly [key: string]: unknown
}

export interface ModelOverride {
  readonly name?: string
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
  readonly efforts?: ReasoningEfforts
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

    for (const [modelIndex, model] of (profile.models ?? []).entries()) {
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
        ...(override?.reasoningEfforts !== undefined
          ? { efforts: override.reasoningEfforts }
          : model.reasoningEfforts !== undefined
            ? { efforts: model.reasoningEfforts }
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
      })
    }
  }

  return rows.sort((left, right) =>
    left.providerName.localeCompare(right.providerName) || left.modelName.localeCompare(right.modelName),
  )
}

/**
 * 生成仅覆盖模型推理能力的路径操作，避免复制整个模型目录。
 * @param row 要修改的模型。
 * @param efforts 新配置；`undefined` 表示恢复适配器默认。
 */
export function reasoningMutation(
  row: ReasoningModelRow,
  efforts: ReasoningEfforts | undefined,
): SettingsPathOperation {
  const path = ['providers', row.providerId, 'modelOverrides', row.modelId, 'reasoningEfforts']
  return efforts === undefined ? { op: 'unset', path } : { op: 'set', path, value: efforts }
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
