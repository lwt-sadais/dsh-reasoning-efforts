export const zh = {
  nav: '推理等级',
  title: '模型推理等级',
  intro: '按模型配置 DSH 可选等级与接口实际接收的值。保存内容写入 modelOverrides，不会复制或替换模型目录。',
  loading: '正在读取模型配置…',
  empty: '当前 llm-pi-ai 配置中没有可编辑模型。',
  loadFailed: '加载模型配置失败',
  readOnly: '当前设置文档为只读。',
  retry: '重试',
  edit: '配置',
  configured: '已自定义',
  inherited: '使用适配器默认',
  unsupported: '不支持推理',
  codexTemplate: '使用 Codex 模板',
  custom: '自定义映射',
  disable: '标记为不支持',
  restore: '恢复适配器默认',
  cancel: '取消',
  save: '保存',
  saving: '保存中…',
  enabled: '启用',
  level: 'DSH 等级',
  wireValue: '接口发送值',
  offHint: '关闭档位可留空，表示不发送推理参数。',
  conflict: '设置已在其他位置发生变化，请重新加载后再编辑。',
  saved: '已保存 {model} 的推理等级。',
} as const

export const en = {
  nav: 'Reasoning', title: 'Model reasoning efforts', intro: 'Configure selectable DSH levels and provider wire values per model. Changes use modelOverrides and do not replace the model catalog.',
  loading: 'Loading model configuration…', empty: 'No editable model exists in the current llm-pi-ai configuration.', loadFailed: 'Failed to load model configuration',
  readOnly: 'The settings document is read-only.', retry: 'Retry', edit: 'Configure', configured: 'Customized', inherited: 'Adapter default', unsupported: 'Reasoning unsupported',
  codexTemplate: 'Use Codex template', custom: 'Custom mapping', disable: 'Mark unsupported', restore: 'Restore adapter default', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
  enabled: 'Enabled', level: 'DSH level', wireValue: 'Wire value', offHint: 'The off value may be empty to omit the reasoning parameter.',
  conflict: 'Settings changed elsewhere. Reload before editing again.', saved: 'Saved reasoning efforts for {model}.',
} as const

export type ReasoningLocaleKey = keyof typeof zh
