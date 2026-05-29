# Goal-Run 深度差距分析

> 对标：CLAUDE.md Harness Constitution + lidangzzz/goal-driven + rihebty/flow-kit
> 日期：2026-05-29

---

## 总结

Goal-Run 的 5 个 harness（Static / Goal / Policy / Criteria / Report）和 18 个 CLI 命令构成了一个**验证守门员**，在 goal spec 质量检查方面做得很好。但当对标 CLAUDE.md 的六组件架构、goal-driven 的持久化循环、flow-kit 的 8 阶段闭环时，发现 **7 个核心问题**，本质上是：Goal-Run 能告诉你"这个 goal 不合格"，但不能帮你把模糊想法变成合格的 goal，也不能在执行过程中防止 AI 犯错。

---

## 问题 1：流程覆盖不完整 — 只有"验证"没有"生产"

### 本质问题

Goal-Run 的 5 个 harness 全部聚焦在 goal spec 验证，但缺少对整个开发流程的编排能力。它是一个"质检员"，但缺少"教练"和"球员"。

### 对比 flow-kit 的 8 阶段闭环

```
CHANGE → REQUIREMENT → DESIGN → TASK → DEV → TEST → REVIEW → INTEGRATION
```

| 阶段                    | flow-kit                                                     | Goal-Run                                                   | 差距               |
| ----------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- | ------------------ |
| CHANGE（需求澄清）      | `0-change.md` — 反问澄清机制，自动生成 change-id             | **无**                                                     | 完全缺失           |
| REQUIREMENT（需求规格） | `1-requirement.md` + `CONTEXT.md` — Given/When/Then AC       | goal-schema.ts 有 `AcceptanceCriterionSchema` 但无生成流程 | 有 schema 无流程   |
| DESIGN（技术设计）      | `2-design.md` — ADR + 风险评估 + 设计对齐检查                | goal-schema.ts 有 `ADRSchema` 但无生成流程                 | 有 schema 无流程   |
| TASK（任务拆解）        | `3-task.md` — 原子任务 + verify 命令绑定 + 并行依赖图        | goal-schema.ts 有 `TaskSpecSchema` 但无拆解流程            | 有 schema 无流程   |
| DEV（开发执行）         | `4-dev.md` — TDD 循环 + 原子提交 + 断点恢复                  | `goalrun run` 只创建目录和 plan.md，**不实际执行 TDD**     | 只创建 scaffold    |
| TEST（测试验证）        | `5-test.md` — 5 轮测试金字塔（功能/性能/安全/兼容/可观测）   | **无** — 只有 verification commands                        | 完全缺失           |
| REVIEW（代码审查）      | `6-review.md` — 双轮审查（规格合规 + 代码质量 + 跨模型抽检） | `code-review` skill 存在但不被 harness 调用                | skill 存在但未集成 |
| INTEGRATION（集成验收） | `7-integration.md` — UAT 引导 + 失败诊断 + LESSONS 归档      | **无**                                                     | 完全缺失           |

### 关键代码证据

`packages/cli/src/commands/run.ts:144-185` — `goalrun run` 的核心逻辑：

```typescript
// 只创建文件，不执行任何开发流程
mkdirSync(runDir, { recursive: true });
writeFileSync(resolve(runDir, 'plan.md'), planReport.agentPrompt, 'utf-8');
writeFileSync(resolve(runDir, 'agent-prompt.md'), planReport.agentPrompt, 'utf-8');
writeFileSync(resolve(runDir, 'policy-gates.json'), ...);
writeFileSync(resolve(runDir, 'verification-checklist.json'), ...);
```

`packages/cli/src/commands/advance.ts:152-154` — `goalrun advance` 的核心逻辑：

```typescript
// 只推进状态机，不验证 agent 实际做了什么
const result = autoAdvance(state);
```

**本质**：Goal-Run 有 8 阶段的 schema 定义（`PIPELINE_STAGES` in `goal-schema.ts:8-17`），但只有"验证 gate"部分有实际实现，其余阶段的"生产"能力完全缺失。

### 对比 goal-driven

goal-driven 的核心循环：

```
while (criteria not met) {
    let subagent work
    check if subagent is active
    verify result against criteria  ← 这步 Goal-Run 缺少
}
```

goal-driven 的 master agent 会**主动验证** subagent 的输出是否满足 criteria，而 Goal-Run 的 advance 只是**被动推进**状态。

---

## 问题 2：半自主循环是伪闭环

### 本质问题

`goalrun run` 创建 run 目录和 plan.md 后，实际执行完全交给外部 AI agent。`goalrun advance` 只是状态机推进，不验证 agent 实际做了什么。

### 关键 gap

| 检查项                               | goal-driven               | flow-kit                | Goal-Run                                         |
| ------------------------------------ | ------------------------- | ----------------------- | ------------------------------------------------ |
| 验证 agent 是否真的跑了 TDD 红绿循环 | master 主动检查           | R5.1 测试必须从 AC 派生 | **只看状态，不看证据**                           |
| diff 边界检查                        | 无                        | R6.5 提交前 verify      | `verifyDiffBoundaries` 存在但只在 advance 时检查 |
| criteria 自动验证                    | master 运行 criteria 检查 | 验证命令必须通过        | `verifyCriteriaAutomatically` 存在但依赖手动触发 |
| 单 task 回滚                         | 无                        | 断点恢复                | **只能回滚整个 run**                             |
| 破坏性变更拦截                       | 无                        | R4.6 完整协议           | `checkDestructiveChange` 检测但不拦截            |

### 关键代码证据

`packages/cli/src/commands/advance.ts:87-99` — TDD 证据检查：

```typescript
// 3. TDD evidence check
const verificationDir = resolve(runDir, 'verification');
if (existsSync(verificationDir)) {
  const requiredEvidence = ['red-phase.txt'];
  const evidenceResult = verifyEvidenceExists(verificationDir, requiredEvidence);
  // ...
  // Don't block on missing evidence, just warn  ← 关键：不阻断！
}
```

**TDD 证据缺失只告警不阻断**，这意味着 agent 可以跳过 RED 阶段直接写实现，Goal-Run 不会阻止。

`packages/cli/src/commands/advance.ts:73-85` — 破坏性变更检查：

```typescript
// 2. Destructive change check
const changedFiles = getChangedFiles(repoRoot);
for (const file of changedFiles.slice(0, 10)) {
  // ← 只检查前 10 个文件！
  const destructiveResult = checkDestructiveChange(repoRoot, file);
  if (destructiveResult.isDestructive) {
    verificationBlocked = true; // ← 会阻断，但不触发完整协议
  }
}
```

**只检查前 10 个文件**，且检测到破坏性变更后**不触发完整的 4 步协议**（grep 引用图 → 反问用户 → codemod 方案 → 回归测试）。

### 对比 flow-kit 的 R4.6 破坏性变更协议

flow-kit 要求：

1. grep 引用图：列出所有调用点
2. 反问用户：删除还是兼容？
3. 提供 codemod/兼容期方案
4. 回归测试覆盖旧路径

Goal-Run 的 `destructive-change.ts` 只做了第 1 步的部分（grep 引用图），其余 3 步完全缺失。

---

## 问题 3：Skill 体系过于简陋

### 本质问题

当前 3 个 skill（implementation-strategy / tdd-change / code-review）每个只有一份 SKILL.md，内容是通用指令，缺少可执行的硬约束。

### 对比 flow-kit 的 skill 体系

| 维度               | flow-kit                                    | Goal-Run skill                                            |
| ------------------ | ------------------------------------------- | --------------------------------------------------------- |
| 可执行 verify 命令 | 每个 task 绑定具体 verify 命令              | skill 只说 "run tests"，没有绑定到具体项目的 test command |
| 文件边界约束       | R7 read_files / write_files 声明            | `FileBoundarySchema` 存在但 skill 不使用                  |
| 失败知识库         | R1.8 LESSONS.md — 每次 DEV 前 grep          | **无**                                                    |
| 上下文控制         | R1 清窗协议（50k tokens / 重复 / 错误循环） | **无**                                                    |
| 角色红线           | R3 Architect 不写代码 / Dev 不改 DESIGN     | **无**                                                    |
| 提交纪律           | R4 conventional commits + 原子提交          | **无**                                                    |
| 反幻觉             | R6 grep 验证 API 存在性                     | `anti-hallucination.ts` 存在但不被 skill 引用             |

### 关键代码证据

`skills/tdd-change/SKILL.md:53-56` — TDD skill 的验证期望：

```markdown
## Verification Expectations

- At least one new or modified test that specifically tests the change
- All existing tests continue to pass (no regressions)
- Goal verification commands all pass
- Diff is focused: no unrelated changes
```

这只是**建议**，不是**强制**。skill 没有绑定到具体的 verify 命令，没有文件边界声明，没有失败知识库检查。

`skills/implementation-strategy/SKILL.md:55-58` — 策略 skill 的安全说明：

```markdown
## Safety Notes

- This skill only reads files and produces a plan. It does not modify code.
- If the strategy identifies risks that cannot be mitigated, stop and escalate.
- Do not proceed to implementation if the strategy is incomplete.
```

同样只是**建议**，harness 不会检查"策略是否完整"就允许进入下一阶段。

### 对比 CLAUDE.md 的 Superpowers 体系

CLAUDE.md 定义的 Superpowers 提供：

- `test-driven-development` — 严格的 Red-Green-Refactor，**必须先写失败测试**
- `verification-before-completion` — 声称完成前**强制验证**
- `requesting-code-review` — 提交前**必须审查**
- `brainstorming` — 设计前**先穷举方案**

这些是**硬约束**，不是建议。Goal-Run 的 skill 只是**文档**，harness 不 enforce。

---

## 问题 4：缺少 brownfield 项目支持

### 本质问题

Goal-Run 的 `goalrun init` 生成的是空的 `.goalrun/` 结构，对已有项目（brownfield）缺少入场扫描和上下文生成。

### 对比 flow-kit 的 brownfield 安全体系（B1-B5）

| Guard              | 功能                           | flow-kit                  | Goal-Run                      |
| ------------------ | ------------------------------ | ------------------------- | ----------------------------- |
| B1 intel-scan      | 检测技术栈、既有抽象、命名约定 | `I-intel-scan.md`         | `intel-scan.ts` **已实现** ✅ |
| B2 DESIGN 0.5 对齐 | 确保新代码与既有架构一致       | DESIGN.md 引用 CONTEXT.md | **缺失** ❌                   |
| B3 文件边界        | 修改范围约束                   | R7 read/write files       | `verifyDiffBoundaries` ✅     |
| B4 破坏性变更      | 删代码/改 API 必须走协议       | R4.6 完整协议             | **部分实现** ⚠️               |
| B5 沿用既有抽象    | 写代码前 grep 同类抽象         | R6.4                      | `checkAbstractionReuse` ✅    |

### 关键发现

`intel-scan.ts` 已经实现了 B1，但存在两个问题：

1. **生成的 CONTEXT.md 不被 harness 引用** — `goalrun verify` 不检查 CONTEXT.md 是否存在，`goalrun plan` 不加载 CONTEXT.md 作为上下文。agent 拿到的 prompt 里没有项目既有约定。

2. **没有 DESIGN 对齐检查** — flow-kit 要求新 DESIGN.md 必须引用 CONTEXT.md 中的既有架构，确保不引入不一致的模式。Goal-Run 没有这个检查。

`intel-scan.ts:263-318` — 生成的 CONTEXT.md 结构：

```typescript
function generateContextMd(scan: ScanResult): string {
  const lines = [
    '# CONTEXT.md — Project Context for AI Agents',
    '## Tech Stack', ...
    '## Existing Abstractions (DO NOT DUPLICATE)', ...
    '## Prohibited Changes', ...
  ];
}
```

内容是好的，但**没有被任何 harness 或 handoff prompt 引用**。agent 不知道 CONTEXT.md 的存在。

---

## 问题 5：安全层有盲区

### 本质问题

security 包做了 5 件事（blocked-commands / external-url / policy-checker / prompt-injection / secret-scan），但对标 CLAUDE.md 和 flow-kit 的安全要求，存在关键盲区。

### 对比表

| 安全机制         | CLAUDE.md            | flow-kit     | Goal-Run                                         |
| ---------------- | -------------------- | ------------ | ------------------------------------------------ |
| 命令黑名单       | 有                   | 有           | ✅ `blocked-commands.ts`                         |
| 密钥扫描         | 有                   | 有           | ✅ `secret-scan.ts`                              |
| 注入检测         | 有                   | 有           | ✅ `prompt-injection.ts`                         |
| URL 安全         | 有                   | 有           | ✅ `external-url.ts`                             |
| 路径遍历防护     | 有                   | 有           | ⚠️ `resolveSafe` 存在但 policy-checker 没调用    |
| 破坏性变更协议   | 有（4 步）           | R4.6（4 步） | ⚠️ 检测但不 enforce 完整协议                     |
| 沿用既有抽象     | 有                   | R6.4         | ✅ `checkAbstractionReuse`                       |
| 提交前 diff 边界 | 有                   | R6.5         | ⚠️ advance 时检查但不阻断 TDD 跳过               |
| 反幻觉 grep 验证 | 有                   | R6.1         | ⚠️ `anti-hallucination.ts` 存在但不被 skill 引用 |
| 提交纪律         | conventional commits | R4.1-R4.6    | **缺失** ❌                                      |
| 角色红线         | Architect 不写代码等 | R3.1-R3.4    | **缺失** ❌                                      |

### 关键代码证据

`packages/security/src/policy-checker.ts` — 没有调用 `resolveSafe` 做路径遍历检查：

policy-checker 只检查 policy config 的完整性和 goal 的 approval gates，但**不检查 goal 或 skill 中是否包含路径遍历攻击**（如 `../../etc/passwd`）。

`packages/core/src/anti-hallucination.ts` — 存在但不被 skill 引用：

```typescript
// 检查 import 是否存在
export function detectExternalApiReference(repoRoot, filePath, content): AntiHallucinationResult;
// 检查 console.* 残留
export function checkAntiHallucination(repoRoot, files): AntiHallucinationResult;
```

这两个函数**存在但不被任何 skill 或 harness 调用**。`tdd-change` skill 不会要求 agent 在写代码前 grep 验证 API 存在性。

---

## 问题 6：缺少"反幻觉"和"上下文控制"机制

### 本质问题

对标 CLAUDE.md 和 flow-kit 的 RULES.md，Goal-Run 完全没有以下关键机制：

| 机制       | CLAUDE.md             | flow-kit RULES                          | Goal-Run                           |
| ---------- | --------------------- | --------------------------------------- | ---------------------------------- |
| 清窗协议   | 有（budget 80% 告警） | R1.1-R1.7 详细（4 触发条件 + 重启协议） | **无**                             |
| 反幻觉     | grep 验证 API 存在性  | R6.1-R6.5（grep + 摘要 + 边界 verify）  | 函数存在但未集成                   |
| 范围控制   | 每 task 文件边界      | R7.1-R7.3                               | 只在 budget 里有 max_changed_files |
| 角色红线   | Architect 不写代码等  | R3.1-R3.4                               | **无**                             |
| 失败知识库 | LESSONS.md            | R1.8 + LESSONS.md                       | **无**                             |
| 提交纪律   | conventional commits  | R4.1-R4.6                               | **无**                             |
| 上下文恢复 | PROGRESS.md           | R1.5 重启协议                           | **无**                             |

### 关键差距详解

**清窗协议**（flow-kit R1.1-R1.7）：

- 4 个触发条件：50k tokens、重复输出、重复错误、用户直觉
- 重启协议：清窗前写 PROGRESS.md（当前状态 + 已排除方案 + 下一步），清窗后按精确顺序重载文件
- 防盲重试：重试前必须检查 PROGRESS.md 中的已排除方案

Goal-Run 没有任何上下文管理。当 AI agent 的上下文填满时，没有协议确保状态不丢失。

**失败知识库**（flow-kit R1.8 + LESSONS.md）：

- 每次 DEV 任务前，AI 必须 grep LESSONS.md 查找匹配条目
- INTEGRATION 归档时，扫描新的失败模式提名到 LESSONS.md
- 防止同样的错误在不同 change 中反复出现

Goal-Run 没有这个机制。同样的错误会在不同 run 中反复出现。

**角色红线**（flow-kit R3.1-R3.4）：

- Architect 不能写代码
- Dev 不能修改 REQUIREMENT 或 DESIGN
- Reviewer 不能修代码 — 只能出报告
- 切换角色需要清窗

Goal-Run 的状态机跟踪 pipeline stage，但**不 enforce agent 在每个阶段能做什么**。dev 阶段的 agent 可以修改 design 文档。

---

## 问题 7：与生态组件的集成是表面的

### 本质问题

`ecosystem.ts` 检测了 5 个组件（superpowers / omc / openspec / gstack / ecc），但检测结果**不被任何 harness 或 handoff 引用**。

### 关键代码证据

`packages/core/src/ecosystem.ts:31-134` — 检测函数：

```typescript
export function detectEcosystem(repoRoot: string): EcosystemDetection {
  // 检测 superpowers、omc、openspec、gstack、ecc 是否安装
  // 返回 boolean + diagnostics
}
```

`packages/core/src/ecosystem.ts:140-208` — 引导计划：

```typescript
export function generateBootstrapPlan(detection: EcosystemDetection): BootstrapPlan {
  // 生成安装缺失组件的命令列表
}
```

### 问题

1. **检测结果不影响 handoff prompt** — `adapter.ts:28-120` 的 `generateHandoff` 不引用 ecosystem 检测结果。如果 superpowers 已安装，handoff prompt 不会告诉 agent 使用 TDD skill。

2. **openspec 集成是 Planned 状态** — README roadmap 显示 "OpenSpec proposal → GoalRun goal bridge" 是 🔲 Planned。当前 openspec/ 目录和 goal schema 没有联动。

3. **不与 OMC 的 ralph/ultrawork/team 集成** — Goal-Run 的 state machine 是自己的，不调用 OMC 的执行模式。

4. **不与 Superpowers 的 TDD/verification/code-review 集成** — Goal-Run 有自己的 3 个 skill，但不引用 Superpowers 的更成熟的 skill 体系。

### 对比 CLAUDE.md 的组件协作协议

CLAUDE.md 定义了明确的协作边界：

- Claude 不绕过 OpenSpec 直接实现 — 先 explore/propose
- OMC 不绕过 Superpowers 直接编码 — 先加载 TDD skill
- gstack 不绕过 Claude 直接决策 — 角色只提供视角

Goal-Run 检测了这些组件的存在，但**不 enforce 协作协议**。

---

## 优先级矩阵

| 优先级 | 问题                           | 影响                                             | 工作量 |
| ------ | ------------------------------ | ------------------------------------------------ | ------ |
| **P0** | 问题 2：半自主循环是伪闭环     | agent 可以跳过 TDD、越界修改、破坏性变更不被拦截 | 中     |
| **P0** | 问题 6：缺少反幻觉和上下文控制 | 同样的错误反复出现，长对话失控                   | 中     |
| **P1** | 问题 1：流程覆盖不完整         | 只有验证没有生产，用户需要手动编排每个阶段       | 高     |
| **P1** | 问题 3：Skill 体系过于简陋     | skill 只是文档不是硬约束                         | 中     |
| **P1** | 问题 7：生态集成是表面的       | 检测了组件但不使用结果                           | 中     |
| **P2** | 问题 5：安全层有盲区           | 路径遍历、提交纪律、角色红线缺失                 | 低-中  |
| **P2** | 问题 4：brownfield 支持不完整  | intel-scan 存在但结果不被引用                    | 低     |

---

## 建议的改进路线图

### Phase 1：闭环（P0）

1. **TDD 证据阻断** — `advance.ts` 中 TDD 证据缺失应阻断而非告警
2. **破坏性变更完整协议** — 检测到后触发 4 步协议
3. **LESSONS.md 机制** — 归档时提名失败模式，DEV 前 grep
4. **清窗协议** — token 预算估算 + PROGRESS.md 生成 + 重启恢复

### Phase 2：生产（P1）

5. **阶段产出物** — 每个 pipeline stage 生成 `.md` 产物（CHANGE.md / REQUIREMENT.md / DESIGN.md / TASK.md / TEST.md / REVIEW.md）
6. **Skill 硬约束** — skill 绑定 verify 命令、文件边界、失败知识库检查
7. **Ecosystem 集成** — handoff prompt 引用 ecosystem 检测结果，推荐已安装的 skill

### Phase 3：安全（P2）

8. **角色红线** — 每个 pipeline stage 定义允许的文件操作
9. **提交纪律** — conventional commits 检查
10. **CONTEXT.md 集成** — handoff prompt 加载 CONTEXT.md 作为上下文

---

## 对比矩阵

| 能力             | goal-driven | flow-kit         | CLAUDE.md      | Goal-Run                        |
| ---------------- | ----------- | ---------------- | -------------- | ------------------------------- |
| Criteria 闭环    | ✅ 核心     | ✅               | ✅             | ✅                              |
| SDD 流水线       | ❌          | ✅ 8 阶段        | ✅ 8 阶段      | ⚠️ 有 schema 无流程             |
| TDD 强制         | ❌          | ✅ R5            | ✅ Superpowers | ⚠️ 有 skill 不 enforce          |
| 安全扫描         | ❌          | ❌               | ✅             | ✅                              |
| Worktree 隔离    | ❌          | ❌               | ✅             | ✅                              |
| Diff 边界        | ❌          | ✅ B3            | ✅             | ⚠️ 检查但不阻断                 |
| 破坏性变更协议   | ❌          | ✅ R4.6          | ✅ 4 步        | ⚠️ 检测不 enforce               |
| 反幻觉           | ❌          | ✅ R6            | ✅             | ⚠️ 函数存在未集成               |
| 清窗协议         | ❌          | ✅ R1            | ⚠️ 部分        | ❌                              |
| LESSONS.md       | ❌          | ✅ R1.8          | ✅             | ❌                              |
| 统一路由         | ❌          | ✅ GO.md         | ❌             | ❌                              |
| 角色红线         | ❌          | ✅ R3            | ✅ gstack      | ❌                              |
| Brownfield 安全  | ❌          | ✅ B1-B5         | ⚠️ 部分        | ⚠️ B1 存在但未集成              |
| 测试金字塔       | ❌          | ✅ 5 轮          | ✅             | ❌                              |
| Token 预算       | ❌          | ✅               | ✅             | ❌                              |
| 产出物持久化     | ❌          | ✅ .md per stage | ❌             | ❌                              |
| 跨模型审查       | ❌          | ✅               | ❌             | ❌                              |
| Subagent 持久化  | ✅          | ❌               | ❌             | ❌                              |
| CI/CD 输出       | ❌          | ❌               | ✅             | ✅ SARIF/JUnit                  |
| 多运行时 handoff | ❌          | ❌               | ❌             | ✅ Claude/Codex/Cursor/OpenCode |
| 生态检测         | ❌          | ❌               | ✅             | ⚠️ 检测不使用                   |

---

## 本质诊断

Goal-Run 的根本问题是**定位模糊**：

- 它想做"验证 harness"，但 5 个 harness 只覆盖了 goal spec 验证，不覆盖运行时验证
- 它想做"流程编排"，但 8 阶段 pipeline 只有 schema 没有实现
- 它想做"安全守卫"，但检测到问题后不 enforce 完整协议
- 它想做"生态集成"，但检测了组件后不使用结果

**建议的定位**：Goal-Run 应该明确自己是"**运行时验证层**"——不重复 flow-kit 的流程编排能力，而是专注于：

1. 在 agent 执行过程中**实时验证**（TDD 证据、diff 边界、破坏性变更）
2. 在 agent 声称完成时**强制验证**（criteria 自动验证、安全扫描）
3. 在跨 run 之间**知识传承**（LESSONS.md、CONTEXT.md）

这样 Goal-Run 与 flow-kit（流程编排）和 CLAUDE.md（执行引擎）形成互补，而不是重复。
