import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { type SettingsPathOperation } from '../core/reasoning.js';
interface SettingsNamespaceView {
    readonly ns: string;
    readonly value: unknown;
    readonly revision: number;
}
interface ApiResult<T> {
    readonly result: {
        readonly ok: true;
        readonly value: T;
    } | {
        readonly ok: false;
        readonly error: {
            readonly code: string;
            readonly message: string;
        };
    };
}
interface SettingsApi {
    readonly settings: {
        describe(request: Record<string, never>): Promise<ApiResult<{
            readonly writable: boolean;
            readonly namespaces: readonly SettingsNamespaceView[];
        }>>;
        mutate(request: {
            readonly ns: string;
            readonly ops: readonly SettingsPathOperation[];
            readonly expectedRevision: number;
        }): Promise<ApiResult<SettingsNamespaceView>>;
    };
}
type Translator = PropsLocale<'settings.reasoningEfforts'>['t'];
interface ReasoningSettingsSectionProps {
    readonly api: SettingsApi;
    readonly t: Translator;
}
/** 推理等级设置页，负责读取、编辑并以 revision 保护方式写回 llm-pi-ai。 */
export declare function ReasoningSettingsSection({ api, t }: ReasoningSettingsSectionProps): import("react").JSX.Element;
export {};
