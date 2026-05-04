# GoalRun

面向软件工程的目标驱动型 Agent Skills 工具链。

**用经过测试的 agent skills 来执行真实的软件工程目标。**

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="#安装"><img src="https://img.shields.io/badge/安装-让_Agent_来-blue?style=for-the-badge" alt="安装"></a>
  <a href="#goalrun-怎么用"><img src="https://img.shields.io/badge/怎么用-10_条命令-orange?style=for-the-badge" alt="怎么用"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20">
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9-blue" alt="pnpm >= 9">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
  <img src="https://img.shields.io/badge/tests-210_passing-brightgreen" alt="210 tests">
</p>

---

## 跳过这个 README 吧

把下面这行发给你的 AI Agent（Claude Code / Codex / Cursor），让它帮你搞定一切：

```
阅读 https://github.com/strings77wzq/goal-run 的 README，
然后告诉我 GoalRun 是什么，以及如何在我的项目中使用它。
```

---

## 安装

### 给人类看的

**别手动装。** 复制下面这段话，粘贴给你的 AI Agent（Claude Code、Codex CLI、Cursor、AmpCode 都行），它会帮你搞定：

```
安装并配置 GoalRun：
1. git clone https://github.com/strings77wzq/goal-run.git
2. cd goal-run && pnpm install
3. pnpm build
4. 把 goalrun 命令加到 PATH，或者用 pnpm link
5. 在我的项目里跑 goalrun init
6. 安装内置 skills：goalrun skill install tdd-change code-review implementation-strategy
7. 跑 goalrun doctor 确认一切正常
```

或者你坚持手动的话：

```bash
git clone https://github.com/strings77wzq/goal-run.git
cd goal-run
pnpm install
pnpm build
pnpm link --global          # 让 goalrun 命令全局可用
cd /你的项目目录
goalrun init
goalrun skill install tdd-change code-review implementation-strategy
goalrun doctor
```

> 说实话，让 Agent 帮你装吧。人类配环境总是容易敲错字母。

### 给 AI Agent 看的

获取安装指南并照做：

```bash
curl -s https://raw.githubusercontent.com/strings77wzq/goal-run/main/AI_GUIDE.md
```

### 等 npm 发布后

```bash
pnpm add -g goalrun        # 一行搞定（即将上线）
```

---

## GoalRun 怎么用

GoalRun 的工作流是 **10 条命令**，按顺序走：

### 第一步：初始化项目

```bash
goalrun init
```

这会在你的项目里创建：
```
AGENTS.md                   # AI Agent 指令
.goalrun/config.yaml        # 配置文件
.goalrun/policy.yaml        # 安全策略
.goalrun/goals/example-fix-bug.yaml  # 示例目标
.agent/skills/              # 技能目录（待安装）
```

### 第二步：安装技能

```bash
goalrun skill install tdd-change code-review implementation-strategy
```

三个内置技能：
- `tdd-change` — 用 TDD 实现 bugfix/feature
- `code-review` — 7 维度结构化代码审查
- `implementation-strategy` — 中高风险变更的实施方案

### 第三步：写一个目标

编辑 `.goalrun/goals/你的目标.yaml`：

```yaml
id: fix-login-timeout
title: 修复登录超时 bug
goal: >
  修复 session 超时导致用户 5 分钟就被登出的问题，应该是 30 分钟。
skills:
  - implementation-strategy
  - tdd-change
  - code-review
criteria:
  - session 超时正确配置为 30 分钟
  - 添加超时测试
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

### 第四步：验证目标

```bash
goalrun verify .goalrun/goals/fix-login-timeout.yaml
```

GoalRun 会检查：
- 目标格式是否正确
- 引用的技能是否已安装
- 是否包含危险指令（rm -rf 等）
- 验收标准是否具体可量化
- 安全策略是否完整

### 第五步：生成执行计划

```bash
goalrun plan .goalrun/goals/fix-login-timeout.yaml
```

输出包含一段 **Agent Prompt**，可以直接复制给 Claude Code / Codex。

### 第六步：创建受监督运行

```bash
goalrun run .goalrun/goals/fix-login-timeout.yaml --supervised --loop
```

这会在 `.goalrun/runs/<时间戳>/` 下创建：
```
plan.md              # 执行计划
agent-prompt.md      # AI Agent 可读的 prompt
status.json          # 运行状态
checkpoints/         # 检查点目录
artifacts/           # 证据和产物
verification/        # 验证结果
```

### 第七步：管理运行循环

```bash
# 查看当前状态
goalrun status

# 推进状态：分享 prompt 给 Agent 后
goalrun resume <run-id> --to waiting_for_agent

# Agent 产出后，审核结果
goalrun resume <run-id> --to waiting_for_user

# 运行验证命令后
goalrun resume <run-id> --to verifying

# 全部通过
goalrun resume <run-id> --to completed

# 或需要修改
goalrun resume <run-id> --to needs_revision

# 或策略阻止
goalrun resume <run-id> --to blocked_by_policy

# 查看详细报告
goalrun report <run-id>

# 停止运行
goalrun stop <run-id>
```

### 状态流转图

```
planned ──→ waiting_for_agent ──→ waiting_for_user ──→ verifying
              (分享 prompt)       (审核 Agent 输出)    (跑验证命令)
                                                      ┌────┴────┐
                                                 completed     needs_revision
                                                   ↑              │
                                                   └── resume ────┘
```

**GoalRun 从不自动推进状态。** 每一次状态变更，都是你亲手执行的。

---

## GoalRun 是什么

GoalRun 是 **agent 辅助软件工程的验证工具链**。它不是你写 prompt 的地方——它验证你的目标、检查你的技能、阻止危险操作、生成执行计划、追踪运行状态。

| GoalRun 做 | GoalRun 不做 |
|-----------|-------------|
| 验证 goal 的完整性和安全性 | 执行你的代码 |
| 检查 skill 质量（格式、权限、密钥泄露） | 调用外部 LLM API |
| 阻止危险命令进入 Agent | 作为 24x7 自主 agent 运行 |
| 生成结构化的执行计划 | 替代 Claude Code / Codex / Cursor |
| 创建可检查点、可恢复的受监督运行 | 做 skills 市场或 registry |
| 检测 prompt 注入和外部 URL | 在无人监督下自动操作 |

**GoalRun 是 harness（脚手架/验证器）。AI 做执行。你保持控制。**

---

## 为什么用 GoalRun

Agent skills 生态正在标准化。GoalRun 补齐了**质量和安全**这一层：

| 没有 GoalRun | 有了 GoalRun |
|-------------|-------------|
| "这个 skill 应该安全吧" | Static harness 验证每个 SKILL.md |
| "应该能跑" | Goal harness 检查 12 个质量维度 |
| "它应该不会跑 rm -rf 吧" | Policy harness 在到达 Agent 之前阻止危险命令 |
| "刚才发生了什么" | 可检查点的运行，结构化审计追踪 |
| "能接着昨天的继续吗" | `goalrun resume` 从最后一个检查点恢复 |
| "这个验收标准能验证吗" | Criteria harness 检测模糊不可验证的目标 |

---

## 全部命令

| 命令 | 做什么 |
|------|--------|
| `goalrun init` | 初始化 `.goalrun/`、`AGENTS.md`、策略配置 |
| `goalrun skill install <skills>` | 安装技能（带 SHA-256 完整性验证） |
| `goalrun lint` | 校验所有 GoalRun 文件 |
| `goalrun test` | 运行确定性 skill 匹配测试 |
| `goalrun plan <goal>` | 生成执行计划 + AI prompt |
| `goalrun verify <goal>` | 5 个 harness 全部跑一遍 |
| `goalrun run <goal> --supervised --loop` | 创建可检查点的受监督运行 |
| `goalrun resume <run-id>` | 推进到下一个状态 |
| `goalrun status [run-id]` | 查看运行状态和验收标准进度 |
| `goalrun stop <run-id>` | 停止运行循环 |
| `goalrun report [run-id]` | 详细运行报告 |
| `goalrun doctor` | 环境健康检查 |

---

## 安全

- **路径约束**：所有写操作限制在项目根目录内
- **不执行命令**：验证命令只检查不执行
- **密钥检测**：12 种正则模式，匹配到的内容绝不打印
- **Prompt 注入检测**：8 种模式检测指令覆盖 / jailbreak
- **外部 URL 警告**：curl/wget 到非白名单域名会报警
- **Lockfile 完整性**：SHA-256 哈希验证已安装的技能未被篡改
- **离线可用**：所有测试不依赖网络

## 开发

```bash
git clone https://github.com/strings77wzq/goal-run.git
cd goal-run
pnpm install
pnpm test        # 210 tests
```

## 路线图

| 阶段 | 状态 |
|------|------|
| P0 — 核心 CLI、5 个 harness、3 个 skills、9 条命令 | ✅ |
| P1 — Lockfile 完整性、安全扫描 v2、标准质量检测 | ✅ |
| P2 — 受监督检查点循环（resume/status/stop） | ✅ |
| P3 — Git worktree 隔离、diff 捕获、回滚 | 计划中 |
| P4 — Adapter 层（Claude/Codex/Cursor prompt 变体） | 计划中 |

## 许可证

MIT
