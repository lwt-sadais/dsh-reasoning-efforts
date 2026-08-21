import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  THINKING_LEVELS,
  codexReasoningTemplate,
  listReasoningModels,
  normalizeReasoningEfforts,
  reasoningMutation,
  type PiAiSection,
  type ReasoningEfforts,
  type ReasoningModelRow,
  type SettingsPathOperation,
  type ThinkingLevel,
} from '../core/reasoning.js'
import type { ReasoningLocaleKey } from './locales.js'

interface SettingsNamespaceView {
  readonly ns: string
  readonly value: unknown
  readonly revision: number
}

interface ApiResult<T> {
  readonly result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }
}

interface SettingsApi {
  readonly settings: {
    describe(request: Record<string, never>): Promise<ApiResult<{ readonly writable: boolean; readonly namespaces: readonly SettingsNamespaceView[] }>>
    mutate(request: { readonly ns: string; readonly ops: readonly SettingsPathOperation[]; readonly expectedRevision: number }): Promise<ApiResult<SettingsNamespaceView>>
  }
}

type Translator = PropsLocale<'settings.reasoningEfforts'>['t']

interface ReasoningSettingsSectionProps {
  readonly api: SettingsApi
  readonly t: Translator
}

interface Snapshot {
  readonly writable: boolean
  readonly revision: number
  readonly rows: readonly ReasoningModelRow[]
}

interface Draft {
  readonly enabled: ReadonlySet<ThinkingLevel>
  readonly values: Readonly<Partial<Record<ThinkingLevel, string>>>
}

/** 将已有配置转换为可编辑表单；继承和不支持状态以 Codex 模板作为起点。 */
function draftFrom(efforts: ReasoningEfforts | undefined): Draft {
  const mapping = efforts === undefined || efforts === false ? codexReasoningTemplate() : efforts
  return {
    enabled: new Set(THINKING_LEVELS.filter(level => mapping[level] !== undefined)),
    values: Object.fromEntries(THINKING_LEVELS.map(level => [level, mapping[level] ?? ''])) as Partial<Record<ThinkingLevel, string>>,
  }
}

/** 返回用户可读的错误消息。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 返回模型当前推理能力状态对应的本地化键。 */
function statusKey(efforts: ReasoningEfforts | undefined): ReasoningLocaleKey {
  if (efforts === false) return 'unsupported'
  return efforts === undefined ? 'inherited' : 'configured'
}

/** 推理等级设置页，负责读取、编辑并以 revision 保护方式写回 llm-pi-ai。 */
export function ReasoningSettingsSection({ api, t }: ReasoningSettingsSectionProps) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReasoningModelRow | null>(null)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(undefined))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  /** 从 Host 获取最新设置描述，并投影模型列表。 */
  const load = useCallback(async () => {
    setFailure(null)
    try {
      const response = await api.settings.describe({})
      if (!response.result.ok) throw new Error(response.result.error.message)
      const namespace = response.result.value.namespaces.find(item => item.ns === 'llm-pi-ai')
      if (!namespace) throw new Error('llm-pi-ai namespace is unavailable')
      setSnapshot({
        writable: response.result.value.writable,
        revision: namespace.revision,
        rows: listReasoningModels(namespace.value as PiAiSection),
      })
    } catch (error) {
      setFailure(messageOf(error))
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  /** 打开模型编辑器并采用当前配置。 */
  const openEditor = useCallback((row: ReasoningModelRow) => {
    setSelected(row)
    setDraft(draftFrom(row.efforts))
    setFailure(null)
    setNotice(null)
  }, [])

  /** 保存一个模型的覆盖；undefined 表示取消覆盖。 */
  const saveEfforts = useCallback(async (efforts: ReasoningEfforts | undefined) => {
    if (!selected || !snapshot) return
    setSaving(true)
    setFailure(null)
    try {
      const response = await api.settings.mutate({
        ns: 'llm-pi-ai',
        ops: [reasoningMutation(selected, efforts)],
        expectedRevision: snapshot.revision,
      })
      if (!response.result.ok) {
        throw new Error(response.result.error.code === 'settings-conflict' ? t('conflict') : response.result.error.message)
      }
      setSelected(null)
      setNotice(t('saved', { model: selected.modelName }))
      await load()
    } catch (error) {
      setFailure(messageOf(error))
    } finally {
      setSaving(false)
    }
  }, [api, load, selected, snapshot, t])

  /** 校验自定义表单并提交映射。 */
  const saveCustom = useCallback(() => {
    try {
      void saveEfforts(normalizeReasoningEfforts(draft.enabled, draft.values))
    } catch (error) {
      setFailure(messageOf(error))
    }
  }, [draft, saveEfforts])

  const groupedRows = useMemo(() => {
    const groups = new Map<string, ReasoningModelRow[]>()
    for (const row of snapshot?.rows ?? []) {
      const key = `${row.providerId}\u0000${row.providerName}`
      groups.set(key, [...(groups.get(key) ?? []), row])
    }
    return [...groups.entries()]
  }, [snapshot])

  if (!snapshot && !failure) return <div className="dreState">{t('loading')}</div>
  if (!snapshot) return <div className="dreState dreError"><strong>{t('loadFailed')}</strong><span>{failure}</span><button type="button" onClick={() => void load()}>{t('retry')}</button></div>

  return <section className="dreSection">
    <header className="dreHeader"><h2>{t('title')}</h2><p>{t('intro')}</p></header>
    {!snapshot.writable && <div className="dreBanner">{t('readOnly')}</div>}
    {notice && <div className="dreNotice" role="status">{notice}</div>}
    {failure && <div className="dreBanner dreError" role="alert">{failure}</div>}
    {snapshot.rows.length === 0 ? <div className="dreState">{t('empty')}</div> : groupedRows.map(([key, rows]) => <div className="dreProvider" key={key}>
      <div className="dreProviderTitle"><strong>{rows[0]!.providerName}</strong><code>{rows[0]!.providerId}</code></div>
      <div className="dreModels">{rows.map(row => <div className="dreModel" key={`${row.providerId}:${row.modelId}`}>
        <div><strong>{row.modelName}</strong><code>{row.modelId}</code></div>
        <span className={`dreStatus dreStatus-${statusKey(row.efforts)}`}>{t(statusKey(row.efforts))}</span>
        <button type="button" disabled={!snapshot.writable} onClick={() => openEditor(row)}>{t('edit')}</button>
      </div>)}</div>
    </div>)}

    {selected && <div className="dreOverlay" role="dialog" aria-modal="true" aria-label={`${t('edit')} ${selected.modelName}`}>
      <button className="dreMask" type="button" aria-label={t('cancel')} onClick={() => setSelected(null)} />
      <div className="dreDialog">
        <div className="dreDialogHeader"><div><strong>{selected.modelName}</strong><code>{selected.providerId} / {selected.modelId}</code></div><button type="button" onClick={() => setSelected(null)}>×</button></div>
        <div className="drePresets">
          <button type="button" disabled={saving} onClick={() => { const template = codexReasoningTemplate(); setDraft(draftFrom(template)) }}>{t('codexTemplate')}</button>
          <button type="button" disabled={saving} onClick={() => void saveEfforts(false)}>{t('disable')}</button>
          <button type="button" disabled={saving} onClick={() => void saveEfforts(undefined)}>{t('restore')}</button>
        </div>
        <div className="dreMappingHeader"><span>{t('enabled')}</span><span>{t('level')}</span><span>{t('wireValue')}</span></div>
        {THINKING_LEVELS.map(level => <label className="dreMapping" key={level}>
          <input type="checkbox" checked={draft.enabled.has(level)} onChange={event => {
            const enabled = new Set(draft.enabled)
            event.target.checked ? enabled.add(level) : enabled.delete(level)
            setDraft(current => ({ ...current, enabled }))
          }} />
          <code>{level}</code>
          <input type="text" disabled={!draft.enabled.has(level)} value={draft.values[level] ?? ''} placeholder={level === 'off' ? t('offHint') : level} onChange={event => setDraft(current => ({ ...current, values: { ...current.values, [level]: event.target.value } }))} />
        </label>)}
        <p className="dreHint">{t('offHint')}</p>
        <div className="dreActions"><button type="button" disabled={saving} onClick={() => setSelected(null)}>{t('cancel')}</button><button className="drePrimary" type="button" disabled={saving} onClick={saveCustom}>{saving ? t('saving') : t('save')}</button></div>
      </div>
    </div>}
  </section>
}
