# dsh-reasoning-efforts

为 DSH Desktop 的自定义 `llm-pi-ai` Provider 提供逐模型推理等级配置页面。

## 功能

- 在 DSH 设置中新增“推理等级”页面。
- 按 Provider 和模型展示当前推理能力状态。
- 提供 Codex 常用映射模板：`off / minimal / low / medium / high / xhigh`。
- 支持自定义每个 DSH 等级实际发送给接口的值。
- 支持标记模型不支持推理，以及恢复适配器默认能力。
- 通过 `settings.describe` 与 `settings.mutate` 写入配置，使用 revision 防止覆盖并发修改。
- 始终写入 `providers.<provider>.modelOverrides.<model>.reasoningEfforts`，不会复制或替换模型目录。

## 安装

请在 DSH Desktop 应用内打开专用终端，然后执行：

```bash
dsh plugin add --profile desktop github:lwt-sadais/dsh-reasoning-efforts
```

安装后完全退出并重新启动 DSH Desktop。

## 配置结果

Codex 模板会生成等价于以下内容的用户设置：

```yaml
llm-pi-ai:
  providers:
    codex:
      modelOverrides:
        gpt-5.6-sol:
          reasoningEfforts:
            off:
            minimal: low
            low: low
            medium: medium
            high: high
            xhigh: xhigh
```

键是 DSH 模型选择器显示的等级，值是 Provider 接口实际接收的字符串。只有 `off` 可以留空；其他已启用等级必须填写非空发送值。

## 开发

```bash
pnpm install
pnpm run check
```

要求 Node.js `^22.19.0` 或 `>=24.0.0`。

## 许可证

MIT
