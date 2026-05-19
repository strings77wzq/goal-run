# GoalRun

**让 AI Agent 说到做到的验证工具链。**

GoalRun 验证目标、检查技能、阻止危险命令、生成 AI 可读的执行计划、管理带检查点的受监督运行——让 Agent 在测试真正通过之前，无法声称"已完成"。

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20">
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9-blue" alt="pnpm >= 9">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
  <img src="https://img.shields.io/badge/tests-318_passing-brightgreen" alt="318 tests">
</p>

---

## GoalRun 是什么

GoalRun 是一个**命令行验证工具链**，用于 AI 辅助软件工程。它位于你和 AI Agent（Claude Code、Codex、Cursor）之间，在 SDD+TDD 全流程的每一步执行质量门禁。

**GoalRun 执行的完整流程：**

```
OpenSpec 提案 → 架构审阅 → TDD 实现 → 验证门禁 → 代码审查 → CI/CD 发布
```

| GoalRun 做的                       | GoalRun 不做的                    |
| ---------------------------------- | --------------------------------- |
| 验证 goal、skill、policy 的正确性  | 执行你的代码                      |
| 阻止危险命令进入 Agent             | 调用外部 LLM API                  |
| 生成 AI 可读的结构化执行计划       | 作为自主 Agent 运行               |
| 创建可检查点、可恢复的受监督运行   | 替代 Claude Code / Codex / Cursor |
| 检测密钥泄露、注入攻击、不安全 URL | 做 skills 市场                    |
| 强制执行 SDD+TDD 流程约束          | 在无人监督下自动操作              |

**GoalRun 是脚手架和验证器。AI 做执行。你保持控制。**

### 适用场景

- 使用 AI Agent 做生产级工程、需要质量门禁的团队
- 采用 **Spec-Driven Development**（SDD，规约驱动开发）+ OpenSpec 的项目
- 希望 Agent 遵循 **Test-Driven Development**（TDD，测试驱动开发）并有证据留痕
- 需要可审计的 Agent 活动记录的工程负责人

### 不适用场景

- 想要完全自主 24×7 运行的 Agent——GoalRun 要求在人类决策点停下
- 想要一键生成代码——GoalRun 只验证，不生成
- 项目没有测试、lint 或 CI——GoalRun 的 harness 需要配合验证命令使用

---

## 快速开始

```bash
# 1. 安装
npm install -g goalrun@alpha

# 2. 初始化项目
cd 你的项目目录
goalrun init

# 3. 安装内置技能
goalrun skill install implementation-strategy tdd-change code-review

# 4. 验证 SDD+TDD 工作流目标
goalrun verify .goalrun/goals/sdd-tdd-workflow.yaml

# 5. 规划并运行
goalrun plan .goalrun/goals/sdd-tdd-workflow.yaml
goalrun run .goalrun/goals/sdd-tdd-workflow.yaml --loop --isolated
```

> **Alpha 提示**：GoalRun 处于 pre-1.0 阶段，API 和文件格式可能变化。请使用 `@alpha` 标签安装。

---

## 工作原理

GoalRun 通过 **5 个 harness** 和一个**半自动状态机**来执行 SDD+TDD 流程：

### 5 个 Harness

| Harness      | 检查内容                                                  |
| ------------ | --------------------------------------------------------- |
| **Static**   | 技能质量 — schema、权限、密钥泄露、危险命令、注入攻击     |
| **Goal**     | 目标完整性 — 技能引用、预算合理性、验收标准质量、危险模式 |
| **Policy**   | 安全门禁 — 阻止的命令、审批要求、技能权限                 |
| **Criteria** | 验收标准质量 — 模糊表述检测、不可验证项、缺少错误路径     |
| **Report**   | 计划生成 — 结构化 Agent prompt、风险摘要、验证清单        |

### 半自动状态循环

GoalRun 自动推进安全状态，只在 **2 个人类决策点**停下：`waiting_for_user`（审查 Agent 产出）和 `blocked_by_policy`（批准/拒绝策略违规）。

```
planned → waiting_for_agent → waiting_for_user 🛑 → verifying → completed
                                  ↓                         ↘ needs_revision
                           （审查 Agent 输出）                    ↓
                                                        （修复后重试）

blocked_by_policy 🛑 — 你来决策：批准还是拒绝
failed — 预算耗尽，自动终止
stopped — 你手动结束运行
```

**每次状态转换都创建一个可审计的检查点。**

---

## 内置技能

GoalRun 内置 3 个技能，覆盖 SDD+TDD 全流程：

| 技能                      | 阶段     | 说明                                                               |
| ------------------------- | -------- | ------------------------------------------------------------------ |
| `implementation-strategy` | **SDD**  | 探索需求、评估影响范围、输出结构化实施方案                         |
| `tdd-change`              | **TDD**  | Red-Green-Refactor：先写失败测试 → 最小实现 → 重构优化             |
| `code-review`             | **验证** | 7 维度审查：正确性、测试、安全、性能、可维护性、可观测性、API 兼容 |

---

## 全部命令

```bash
# 项目初始化
goalrun init                          # 创建 .goalrun/、AGENTS.md、策略配置、示例目标
goalrun skill install <skill...>      # 安装技能（带 SHA-256 完整性校验）
goalrun doctor                        # 环境健康检查

# SDD 阶段 — 规约与设计
goalrun verify <goal>                 # 对目标运行全部 5 个 harness
goalrun verify <goal> --format sarif  # 输出 SARIF v2.1.0 格式 (GitHub Code Scanning)
goalrun verify <goal> --format junit  # 输出 JUnit XML 格式 (GitLab CI, Jenkins)
goalrun plan <goal>                   # 生成执行计划 + AI prompt
goalrun from-issue <url>              # 从 GitHub issue 生成 goal.yaml

# TDD 阶段 — 受监督执行
goalrun run <goal> --loop --isolated  # 创建可检查点的受监督运行（worktree 隔离）
goalrun advance <run-id>              # 半自动推进 — 只在人类决策点停下
goalrun resume <run-id> --to <状态>   # 手动推进到指定状态
goalrun status [run-id]               # 查看运行状态和验收标准
goalrun stop <run-id>                 # 停止运行
goalrun report [run-id]               # 详细运行报告
goalrun rollback <run-id>             # 回滚变更（删除 worktree 或 git reset）

# CI/CD 阶段 — 验证与发布
goalrun audit <run-id>                # 生成 PR-ready 审计报告
goalrun compare <run-a> <run-b>       # 对比两次运行差异
goalrun handoff <goal> --target <t>   # 生成指定运行时（claude/codex/cursor/opencode）的 prompt
```

---

## Goal 规范示例

```yaml
id: fix-login-timeout
title: 修复登录超时 bug
goal: 修复 session 超时导致用户 5 分钟就登出的问题，正确配置为 30 分钟。
skills:
  - implementation-strategy
  - tdd-change
  - code-review
criteria:
  - session 超时正确配置为 30 分钟
  - 添加超时回归测试
  - 不改变公开 API
  - 已有 auth 测试全部通过
budget:
  max_iterations: 5
  max_changed_files: 10
  max_runtime_minutes: 60
policy:
  require_approval_for:
    - changes_public_api
    - modifies_auth_code
verification:
  commands:
    - pnpm test
    - pnpm typecheck
```

---

## 安全

- **不执行代码**：GoalRun 验证命令但不运行它们
- **路径约束**：所有写操作和 git 操作限制在项目根目录内
- **Worktree 隔离**：`--isolated` 创建独立 git worktree；回滚只删除 GoalRun 管理的分支
- **结构化 git 参数**：使用参数数组，绝不拼接 shell 字符串
- **密钥检测**：12 种正则模式，匹配到的内容绝不打印
- **注入检测**：8 种模式检测指令覆盖 / jailbreak
- **Lockfile 完整性**：SHA-256 哈希验证已安装技能未被篡改
- **离线可用**：所有测试不依赖网络

---

## 开发

```bash
git clone https://github.com/strings77wzq/goal-run.git
cd goal-run
pnpm install
pnpm test        # 318 个测试全部通过
pnpm typecheck   # TypeScript 严格模式
pnpm lint        # ESLint
pnpm build       # 5 个包全部构建
```

---

## 路线图

GoalRun 处于 **alpha** 阶段（0.1.0-alpha.7）。

| 能力                                             | 状态      |
| ------------------------------------------------ | --------- |
| Goal 规范验证 + 5 个 harness                     | ✅ Alpha  |
| 技能安装 + 完整性校验                            | ✅ Alpha  |
| 安全扫描（密钥、注入、URL）                      | ✅ Alpha  |
| 受监督检查点循环（advance/resume/status/stop）   | ✅ Alpha  |
| Git worktree 隔离 + diff 捕获 + 回滚             | ✅ Alpha  |
| 多运行时 handoff（Claude/Codex/Cursor/OpenCode） | ✅ Alpha  |
| OpenSpec SDD 流程集成                            | ✅ Alpha  |
| CI/CD 输出格式: SARIF v2.1.0 + JUnit XML         | ✅ Alpha  |
| npm install -g goalrun@alpha                     | ✅ 可用   |
| OpenSpec proposal → GoalRun goal 桥接            | 🔲 计划中 |

---

## 许可证

MIT
