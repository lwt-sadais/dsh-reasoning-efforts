import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { ReasoningSettingsSection } from './ReasoningSettingsSection.js'
import { en, zh, type ReasoningLocaleKey } from './locales.js'
import styles from './styles.css?inline'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.reasoningEfforts': ReasoningLocaleKey
  }
}

export const inject = ['slots', 'locale', 'connection', 'remote']
const NS = 'settings.reasoningEfforts'

/** 注册推理等级设置页、词典和配置更新监听。 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.dshReasoningEfforts = ''
    style.textContent = styles
    document.head.appendChild(style)
    return () => style.remove()
  }, 'dsh-reasoning-efforts: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-reasoning-efforts: dictionaries')

  const connection = ctx.get('connection')
  const t = ctx.locale.bind(NS)
  const injected = () => ({ api: connection.api, t })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'reasoning-efforts',
    order: 20,
    label: () => t('nav'),
    inject: injected,
  }, ReasoningSettingsSection))
}

export { ReasoningSettingsSection } from './ReasoningSettingsSection.js'
