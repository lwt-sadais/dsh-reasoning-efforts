import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('alpha.1 settings Remote integration', () => {
  it('injects ctx.remote.settings instead of the removed connection.api surface', async () => {
    const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(source).toContain("'remote.settings'")
    expect(source).toContain('api: { settings: ctx.remote.settings }')
    expect(source).not.toContain('connection.api')
  })

  it('uses alpha.1 describe and mutate call signatures without a nested result envelope', async () => {
    const source = await readFile(new URL('../src/client/ReasoningSettingsSection.tsx', import.meta.url), 'utf8')
    expect(source).toContain('api.settings.describe()')
    expect(source).toMatch(/api\.settings\.mutate\(\s*'llm-pi-ai',\s*\[reasoningMutation\(selected, efforts\)\],\s*snapshot\.revision,/u)
    expect(source).not.toContain('response.result')
  })
})
