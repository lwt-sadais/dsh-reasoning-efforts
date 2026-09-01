import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  THINKING_LEVELS,
  codexReasoningTemplate,
  inputFromMode,
  inputModeOf,
  listReasoningModels,
  modelCapabilityMutations,
  normalizeReasoningEfforts,
  type InputMode,
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

type RemoteResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

interface SettingsApi {
  readonly settings: {
    describe(): Promise<RemoteResult<{ readonly writable: boolean; readonly namespaces: readonly SettingsNamespaceView[] }>>
    mutate(ns: string, ops: readonly SettingsPathOperation[], expectedRevision: number): Promise<RemoteResult<SettingsNamespaceView>>
  }
}

type Translator = PropsLocale<'settings.reasoningEfforts'>['t']
type ReasoningMode = 'custom' | 'unsupported' | 'inherit'

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
  readonly reasoningMode: ReasoningMode
  readonly enabled: ReadonlySet<ThinkingLevel>
  readonly values: Readonly<Partial<Record<ThinkingLevel, string>>>
  readonly inputMode: InputMode
}

/** 将已有配置转换为可编辑表单，并保留继承与不支持两种独立状态。 */
function draftFrom(row: Pick<ReasoningModelRow, 'efforts' | 'input'>): Draft {
  const mapping = row.efforts === undefined || row.efforts === false ? codexReasoningTemplate() : row.efforts
  return {
    reasoningMode: row.efforts === undefined ? 'inherit' : row.efforts === false ? 'unsupported' : 'custom',
    enabled: new Set(THINKING_LEVELS.filter(level => mapping[level] !== undefined)),
    values: Object.fromEntries(THINKING_LEVELS.map(level => [level, mapping[level] ?? ''])) as Partial<Record<ThinkingLevel, string>>,
    inputMode: inputModeOf(row.input),
  }
}

/** 返回用户可读的错误消息。 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 返回模型当前推理能力状态对应的本地化键。 */
function reasoningStatusKey(efforts: ReasoningEfforts | undefined): ReasoningLocaleKey {
  if (efforts === false) return 'unsupported'
  return efforts === undefined ? 'inherited' : 'configured'
}

/** 返回模型当前显式输入能力对应的本地化键。 */
function inputStatusKey(row: Pick<ReasoningModelRow, 'input'>): ReasoningLocaleKey {
  const mode = inputModeOf(row.input)
  if (mode === 'text-image') return 'inputTextImage'
  if (mode === 'text') return 'inputText'
  if (mode === 'custom') return 'inputCustom'
  return 'inputInherited'
}

/** 将表单的推理状态转换为写入值，并校验自定义映射。 */
function effortsFromDraft(draft: Draft): ReasoningEfforts | undefined {
  if (draft.reasoningMode === 'inherit') return undefined
  if (draft.reasoningMode === 'unsupported') return false
  return normalizeReasoningEfforts(draft.enabled, draft.values)
}

/** 推理等级设置页，负责读取、编辑并以 revision 保护方式原子写回模型能力。 */
export function ReasoningSettingsSection({ api, t }: ReasoningSettingsSectionProps) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [selected, setSelected] = useState<ReasoningModelRow | null>(null)
  const [draft, setDraft] = useState<Draft>(() => draftFrom({}))
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [notice, setNotice] = useState<string | null>(null)

  /** 从 Host 获取最新设置描述，并投影模型列表。 */
  const load = useCallback(async () => {
    setFailure(null)
    try {
      const response = await api.settings.describe()
      if (!response.ok) throw new Error(response.error.message)
      const namespace = response.value.namespaces.find(item => item.ns === 'llm-pi-ai')
      if (!namespace) throw new Error('llm-pi-ai namespace is unavailable')
      setSnapshot({
        writable: response.value.writable,
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

  /** 打开模型编辑器并采用当前推理与输入能力配置。 */
  const openEditor = useCallback((row: ReasoningModelRow) => {
    setSelected(row)
    setDraft(draftFrom(row))
    setFailure(null)
    setNotice(null)
  }, [])

  /** 校验并原子保存一个模型的推理等级与输入能力。 */
  const saveCapabilities = useCallback(async () => {
    if (!selected || !snapshot || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setFailure(null)
    try {
      const response = await api.settings.mutate(
        'llm-pi-ai',
        modelCapabilityMutations(selected, effortsFromDraft(draft), inputFromMode(draft.inputMode, selected.input)),
        snapshot.revision,
      )
      if (!response.ok) {
        throw new Error(response.error.code === 'settings-conflict' ? t('conflict') : response.error.message)
      }
      setSelected(null)
      setNotice(t('saved', { model: selected.modelName }))
      await load()
    } catch (error) {
      setFailure(messageOf(error))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [api, draft, load, selected, snapshot, t])

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
        <div className="dreModelIdentity"><strong>{row.modelName}</strong><code>{row.modelId}</code></div>
        <div className="dreStatuses">
          <span className={`dreStatus dreStatus-${reasoningStatusKey(row.efforts)}`}>{t(reasoningStatusKey(row.efforts))}</span>
          <span className={`dreStatus dreStatus-${inputModeOf(row.input)}`}>{t(inputStatusKey(row))}</span>
        </div>
        <button type="button" disabled={!snapshot.writable} onClick={() => openEditor(row)}>{t('edit')}</button>
      </div>)}</div>
    </div>)}

    {selected && <div className="dreOverlay" role="dialog" aria-modal="true" aria-label={`${t('edit')} ${selected.modelName}`}>
      <button className="dreMask" type="button" aria-label={t('cancel')} onClick={() => setSelected(null)} />
      <div className="dreDialog">
        <div className="dreDialogHeader"><div><strong>{selected.modelName}</strong><code>{selected.providerId} / {selected.modelId}</code></div><button type="button" onClick={() => setSelected(null)}>×</button></div>
        <section className="dreCapabilityBlock">
          <h3>{t('reasoningTitle')}</h3>
          <div className="drePresets">
            <button type="button" disabled={saving} onClick={() => setDraft(current => ({ ...draftFrom({ efforts: codexReasoningTemplate() }), inputMode: current.inputMode }))}>{t('codexTemplate')}</button>
            <button type="button" disabled={saving} onClick={() => setDraft(current => ({ ...current, reasoningMode: 'unsupported' }))}>{t('disable')}</button>
            <button type="button" disabled={saving} onClick={() => setDraft(current => ({ ...current, reasoningMode: 'inherit' }))}>{t('restore')}</button>
          </div>
          {draft.reasoningMode === 'custom' ? <>
            <div className="dreMappingHeader"><span>{t('enabled')}</span><span>{t('level')}</span><span>{t('wireValue')}</span></div>
            {THINKING_LEVELS.map(level => <label className="dreMapping" key={level}>
              <input type="checkbox" checked={draft.enabled.has(level)} onChange={event => {
                const enabled = new Set(draft.enabled)
                event.target.checked ? enabled.add(level) : enabled.delete(level)
                setDraft(current => ({ ...current, enabled, reasoningMode: 'custom' }))
              }} />
              <code>{level}</code>
              <input type="text" disabled={!draft.enabled.has(level)} value={draft.values[level] ?? ''} placeholder={level === 'off' ? t('offHint') : level} onChange={event => setDraft(current => ({ ...current, reasoningMode: 'custom', values: { ...current.values, [level]: event.target.value } }))} />
            </label>)}
            <p className="dreHint">{t('offHint')}</p>
          </> : <p className="dreModeNotice">{t(draft.reasoningMode === 'inherit' ? 'reasoningInheritNotice' : 'reasoningUnsupportedNotice')}</p>}
        </section>
        <section className="dreCapabilityBlock">
          <h3>{t('inputTitle')}</h3>
          <p className="dreHint">{t('inputHint')}</p>
          <div className="dreInputModes">
            {([...(draft.inputMode === 'custom' ? ['custom'] as const : []), 'inherit', 'text', 'text-image'] as const).map(mode => <label key={mode}>
              <input type="radio" name="input-mode" value={mode} checked={draft.inputMode === mode} disabled={mode === 'custom'} onChange={() => setDraft(current => ({ ...current, inputMode: mode }))} />
              <span><strong>{t(mode === 'custom' ? 'inputCustomOption' : mode === 'inherit' ? 'inputInherit' : mode === 'text' ? 'inputTextOption' : 'inputTextImageOption')}</strong>{mode === 'custom' && <small>{t('inputCustomHint')}</small>}{mode === 'text-image' && <small>{t('inputImageWarning')}</small>}</span>
            </label>)}
          </div>
          <code className="dreInputPreview">{draft.inputMode === 'inherit'
            ? t('inputPreviewInherit')
            : `input: [${inputFromMode(draft.inputMode, selected.input)!.join(', ')}]`}</code>
        </section>
        <div className="dreActions"><button type="button" disabled={saving} onClick={() => setSelected(null)}>{t('cancel')}</button><button className="drePrimary" type="button" disabled={saving} onClick={() => void saveCapabilities()}>{saving ? t('saving') : t('saveCapabilities')}</button></div>
      </div>
    </div>}
  </section>
}
