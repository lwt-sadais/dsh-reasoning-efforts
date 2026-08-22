import { describe, expect, it } from 'vitest'
import {
  codexReasoningTemplate,
  listReasoningModels,
  normalizeReasoningEfforts,
  reasoningMutation,
} from '../src/core/reasoning.js'

describe('reasoning configuration', () => {
  it('projects model and override entries without duplicates', () => {
    const rows = listReasoningModels({
      providers: {
        codex: {
          displayName: 'Codex',
          models: [{ id: 'gpt-5', name: 'GPT 5' }],
          modelOverrides: {
            'gpt-5': { reasoningEfforts: codexReasoningTemplate() },
            'gpt-6': { name: 'GPT 6', reasoningEfforts: false },
          },
        },
      },
    })

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ modelId: 'gpt-5', source: 'model' })
    expect(rows[1]).toMatchObject({ modelId: 'gpt-6', source: 'override', efforts: false })
  })

  it('writes declared models as a preserved array', () => {
    const rows = listReasoningModels({
      providers: {
        'codex-car': {
          models: [
            { id: 'gpt-4', name: 'GPT 4', contextWindow: 128000 },
            { id: 'gpt-5', name: 'GPT 5', contextWindow: 1000000, reasoningEfforts: false },
          ],
        },
      },
    })
    const row = rows.find(item => item.modelId === 'gpt-5')!
    expect(reasoningMutation(row, codexReasoningTemplate())).toEqual({
      op: 'set',
      path: ['providers', 'codex-car', 'models'],
      value: [
        { id: 'gpt-4', name: 'GPT 4', contextWindow: 128000 },
        { id: 'gpt-5', name: 'GPT 5', contextWindow: 1000000, reasoningEfforts: codexReasoningTemplate() },
      ],
    })
    expect(reasoningMutation(row, undefined)).toEqual({
      op: 'set',
      path: ['providers', 'codex-car', 'models'],
      value: [
        { id: 'gpt-4', name: 'GPT 4', contextWindow: 128000 },
        { id: 'gpt-5', name: 'GPT 5', contextWindow: 1000000 },
      ],
    })
  })

  it('keeps catalog-only entries in modelOverrides', () => {
    const row = listReasoningModels({
      providers: { codex: { modelOverrides: { 'gpt-5': { reasoningEfforts: false } } } },
    })[0]!
    expect(reasoningMutation(row, codexReasoningTemplate())).toEqual({
      op: 'set',
      path: ['providers', 'codex', 'modelOverrides', 'gpt-5', 'reasoningEfforts'],
      value: codexReasoningTemplate(),
    })
  })

  it('normalizes enabled levels and rejects missing wire values', () => {
    expect(normalizeReasoningEfforts(new Set(['off', 'high']), { high: ' high ' })).toEqual({
      off: null,
      high: 'high',
    })
    expect(() => normalizeReasoningEfforts(new Set(['off', 'high']), {})).toThrow('high 需要填写发送值')
    expect(() => normalizeReasoningEfforts(new Set(['off']), {})).toThrow('至少启用一个非关闭推理等级')
  })
})
