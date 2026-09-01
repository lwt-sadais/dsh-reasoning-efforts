import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type ReasoningLocaleKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'settings.reasoningEfforts': ReasoningLocaleKey;
    }
}
export declare const inject: string[];
/** 注册推理等级设置页、词典和配置更新监听。 */
export declare function apply(ctx: ClientContext): void;
export { ReasoningSettingsSection } from './ReasoningSettingsSection.js';
