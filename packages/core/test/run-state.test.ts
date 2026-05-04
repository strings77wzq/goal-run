import { describe, it, expect } from "vitest";
import {
  RunStateSchema,
  RunStatusSchema,
  createRunState,
  advanceState,
  canAdvanceTo,
  isTerminal,
  VALID_TRANSITIONS,
  type RunState,
  type RunStatus,
} from "../src/run-state.js";

describe("RunStatusSchema", () => {
  it("accepts all valid status values", () => {
    const valid = [
      "planned", "waiting_for_agent", "waiting_for_user",
      "verifying", "needs_revision", "blocked_by_policy",
      "completed", "failed", "stopped",
    ];
    for (const s of valid) {
      expect(RunStatusSchema.safeParse(s).success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    expect(RunStatusSchema.safeParse("running").success).toBe(false);
    expect(RunStatusSchema.safeParse("paused").success).toBe(false);
  });
});

describe("RunStateSchema", () => {
  it("validates a complete run state", () => {
    const state = {
      run_id: "2026-05-04T12-00-00-000Z",
      goal_id: "example-fix-bug",
      status: "planned",
      iteration: 0,
      max_iterations: 5,
      skills: ["tdd-change"],
      criteria: [{ text: "tests pass", status: "pending" }],
      started_at: new Date().toISOString(),
      checkpoints: [],
      budget: { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      policy_gates: [],
    };
    expect(RunStateSchema.safeParse(state).success).toBe(true);
  });

  it("rejects negative iteration", () => {
    const state = {
      run_id: "r1", goal_id: "g1", status: "planned",
      iteration: -1, max_iterations: 5, skills: [], criteria: [],
      started_at: new Date().toISOString(), checkpoints: [],
      budget: { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      policy_gates: [],
    };
    expect(RunStateSchema.safeParse(state).success).toBe(false);
  });
});

describe("createRunState", () => {
  it("creates initial planned state", () => {
    const state = createRunState(
      "run-001",
      "fix-bug",
      ["tdd-change", "code-review"],
      ["tests pass", "no regression"],
      { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 },
      ["changes_public_api"],
    );
    expect(state.status).toBe("planned");
    expect(state.iteration).toBe(0);
    expect(state.run_id).toBe("run-001");
    expect(state.criteria).toEqual([
      { text: "tests pass", status: "pending" },
      { text: "no regression", status: "pending" },
    ]);
  });
});

describe("VALID_TRANSITIONS", () => {
  it("planned can go to waiting_for_agent", () => {
    expect(VALID_TRANSITIONS.planned).toContain("waiting_for_agent");
  });

  it("waiting_for_agent can go to waiting_for_user", () => {
    expect(VALID_TRANSITIONS.waiting_for_agent).toContain("waiting_for_user");
  });

  it("verifying can go to completed or needs_revision", () => {
    expect(VALID_TRANSITIONS.verifying).toContain("completed");
    expect(VALID_TRANSITIONS.verifying).toContain("needs_revision");
  });

  it("terminal states have no transitions", () => {
    expect(VALID_TRANSITIONS.completed).toHaveLength(0);
    expect(VALID_TRANSITIONS.failed).toHaveLength(0);
    expect(VALID_TRANSITIONS.stopped).toHaveLength(0);
  });
});

describe("canAdvanceTo", () => {
  it("allows valid transition", () => {
    expect(canAdvanceTo("planned", "waiting_for_agent")).toBe(true);
  });

  it("rejects invalid transition", () => {
    expect(canAdvanceTo("planned", "completed")).toBe(false);
  });

  it("rejects transition from terminal state", () => {
    expect(canAdvanceTo("completed", "planned")).toBe(false);
  });
});

describe("advanceState", () => {
  it("advances to next valid status", () => {
    const state = createRunState("r1", "g1", ["s1"], ["c1"], { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 }, []);
    const result = advanceState(state, "waiting_for_agent");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state.status).toBe("waiting_for_agent");
    }
  });

  it("rejects invalid transition", () => {
    const state = createRunState("r1", "g1", ["s1"], ["c1"], { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 }, []);
    const result = advanceState(state, "completed");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Cannot transition");
    }
  });

  it("increments iteration when advancing to waiting_for_agent", () => {
    const state = createRunState("r1", "g1", ["s1"], ["c1"], { max_iterations: 5, max_changed_files: 20, max_runtime_minutes: 60 }, []);
    const result = advanceState(state, "waiting_for_agent");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.state.iteration).toBe(1);
    }
  });
});

describe("isTerminal", () => {
  it("completed is terminal", () => expect(isTerminal("completed")).toBe(true));
  it("failed is terminal", () => expect(isTerminal("failed")).toBe(true));
  it("stopped is terminal", () => expect(isTerminal("stopped")).toBe(true));
  it("planned is not terminal", () => expect(isTerminal("planned")).toBe(false));
  it("waiting_for_agent is not terminal", () => expect(isTerminal("waiting_for_agent")).toBe(false));
});
