# GoalRun

面向软件工程的目标驱动型 Agent Skills 工具链。

**用经过测试的 agent skills 来执行真实的软件工程目标。**

GoalRun 是一个 CLI 工具链，帮助你使用目标规范和已验证的 skills 来定义、测试和运行 agent 辅助的工程工作流。它会验证目标、执行策略，并生成结构化的执行计划 —— 但不会调用外部 LLM，也不会执行你的代码。

## 快速开始

```bash
# 在你的项目中初始化 GoalRun
goalrun init

# 安装内置 skills
goalrun skill install tdd-change code-review implementation-strategy

# 检查环境
goalrun doctor

# 为目标生成执行计划
goalrun plan .goalrun/goals/example-fix-bug.yaml

# 验证目标完整性
goalrun verify .goalrun/goals/example-fix-bug.yaml

# 创建受监督的运行（生成计划，不执行代码）
goalrun run .goalrun/goals/example-fix-bug.yaml --supervised
```

## GoalRun 是什么

- 目标规范验证器
- Skill 质量检查工具
- Agent 原生仓库脚手架
- 工程 skill 包
- 策略与验证层
- 受监督的目标运行器

## GoalRun 不是什么

- 不是 skill 集合或市场
- 不是 prompt 库
- 不是自主 agent 框架
- 不是云服务
- 不是 Claude Code / Codex / Cursor 等 agent 运行时的替代品

## 核心理念

- 目标是运行时契约
- Skills 是可复用的工作流
- Agent 工作流带有测试、策略、检查点和 CI
- 先受监督，后自主
- 证据胜过信心

## 内置 Skills

| Skill | 用途 |
|-------|------|
| `implementation-strategy` | 中高风险变更的实施方案规划 |
| `tdd-change` | 严格的 TDD 实现（红-绿-重构） |
| `code-review` | 结构化代码审查 |

## 验证体系

GoalRun 有五个验证 harness：

| Harness | 检查内容 |
|---------|---------|
| **Static** | SKILL.md 有效性、无密钥泄露、无危险命令 |
| **Selection** | 确定性 skill 匹配测试 |
| **Goal** | Goal spec 模式、skill 引用、危险指令、预算合理性 |
| **Policy** | 被阻止的命令、审批门槛、skill 权限 |
| **Report** | 结构化诊断收集和格式化 |

## 安全说明

- GoalRun 不会执行你的代码、测试或验证命令。它只读取、验证和报告。
- 所有文件写入仅限于项目根目录。
- GoalRun 会扫描 skill 内容中的密钥和危险命令 —— 但不能替代专业的安全工具。
- 在将生成的 agent prompt 分享给 AI 助手之前，请先审查。
- 策略门槛对人类操作者是建议性的。AI 助手应该遵守，但 GoalRun 无法在操作系统层面强制执行。

## 路线图

P0 已完成，P1 规划中（远程 skill registry、检查点循环运行器、多目标编排等）。

## 许可证

MIT
