import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import { type SettingsPathOperation } from '../core/reasoning.js';
interface SettingsNamespaceView {
    readonly ns: string;
    readonly value: unknown;
    readonly revision: number;
}
type RemoteResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
};
interface SettingsApi {
    readonly settings: {
        describe(): Promise<RemoteResult<{
            readonly writable: boolean;
            readonly namespaces: readonly SettingsNamespaceView[];
        }>>;
        mutate(ns: string, ops: readonly SettingsPathOperation[], expectedRevision: number): Promise<RemoteResult<SettingsNamespaceView>>;
    };
}
type Translator = PropsLocale<'settings.reasoningEfforts'>['t'];
interface ReasoningSettingsSectionProps {
    readonly api: SettingsApi;
    readonly t: Translator;
}
/** 推理等级设置页，负责读取、编辑并以 revision 保护方式原子写回模型能力。 */
export declare function ReasoningSettingsSection({ api, t }: ReasoningSettingsSectionProps): import("react/jsx-runtime").JSX.Element;
export {};
