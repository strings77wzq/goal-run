import { describe, it, expect } from "vitest";
import {
  LockfileSchema,
  createLockfile,
  addSkillToLockfile,
  removeSkillFromLockfile,
  hasSkill,
  getSkillInfo,
  computeSkillHash,
  verifyIntegrity,
  type Lockfile,
} from "../src/lockfile.js";

describe("LockfileSchema", () => {
  it("validates a valid lockfile", () => {
    const lock = {
      version: 1 as const,
      skills: {
        "tdd-change": {
          version: "1.0.0",
          installed_at: "2026-05-04T00:00:00.000Z",
          source: "builtin" as const,
        },
      },
    };
    expect(LockfileSchema.safeParse(lock).success).toBe(true);
  });

  it("validates empty skills", () => {
    const lock = { version: 1 as const, skills: {} };
    expect(LockfileSchema.safeParse(lock).success).toBe(true);
  });

  it("rejects version other than 1", () => {
    const lock = { version: 2, skills: {} };
    expect(LockfileSchema.safeParse(lock).success).toBe(false);
  });

  it("rejects non-builtin source", () => {
    const lock = {
      version: 1 as const,
      skills: {
        x: { version: "1.0.0", installed_at: "date", source: "registry" },
      },
    };
    expect(LockfileSchema.safeParse(lock).success).toBe(false);
  });
});

describe("createLockfile", () => {
  it("creates an empty lockfile", () => {
    const lock = createLockfile();
    expect(lock.version).toBe(1);
    expect(lock.skills).toEqual({});
  });
});

describe("addSkillToLockfile", () => {
  it("adds a new skill entry", () => {
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "code-review", "2.0.0");
    expect(updated.skills["code-review"]?.version).toBe("2.0.0");
    expect(updated.skills["code-review"]?.source).toBe("builtin");
    expect(updated.skills["code-review"]?.installed_at).toBeDefined();
  });

  it("overwrites existing skill entry", () => {
    const lock = createLockfile();
    const first = addSkillToLockfile(lock, "tdd-change", "1.0.0");
    const second = addSkillToLockfile(first, "tdd-change", "2.0.0");
    expect(second.skills["tdd-change"]?.version).toBe("2.0.0");
  });

  it("does not mutate original lockfile", () => {
    const lock = createLockfile();
    addSkillToLockfile(lock, "test", "1.0.0");
    expect(lock.skills).toEqual({});
  });
});

describe("removeSkillFromLockfile", () => {
  it("removes a skill", () => {
    let lock = createLockfile();
    lock = addSkillToLockfile(lock, "test", "1.0.0");
    expect(hasSkill(lock, "test")).toBe(true);
    lock = removeSkillFromLockfile(lock, "test");
    expect(hasSkill(lock, "test")).toBe(false);
  });
});

describe("hasSkill", () => {
  it("returns true for installed skill", () => {
    let lock = createLockfile();
    lock = addSkillToLockfile(lock, "x", "1.0.0");
    expect(hasSkill(lock, "x")).toBe(true);
  });

  it("returns false for missing skill", () => {
    expect(hasSkill(createLockfile(), "nope")).toBe(false);
  });
});

describe("getSkillInfo", () => {
  it("returns skill info for installed skill", () => {
    let lock = createLockfile();
    lock = addSkillToLockfile(lock, "code-review", "3.0.0");
    const info = getSkillInfo(lock, "code-review");
    expect(info?.version).toBe("3.0.0");
    expect(info?.source).toBe("builtin");
  });

  it("returns undefined for missing skill", () => {
    expect(getSkillInfo(createLockfile(), "nope")).toBeUndefined();
  });
});

describe("computeSkillHash", () => {
  it("returns a 64-char hex string for any content", () => {
    const hash = computeSkillHash("hello");
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
  });

  it("returns different hashes for different content", () => {
    const h1 = computeSkillHash("hello");
    const h2 = computeSkillHash("world");
    expect(h1).not.toBe(h2);
  });

  it("returns same hash for same content (deterministic)", () => {
    expect(computeSkillHash("test")).toBe(computeSkillHash("test"));
  });
});

describe("addSkillToLockfile integrity fields", () => {
  it("includes sha256 in installed skill entry", () => {
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "test", "2.0.0", "abc123");
    expect(updated.skills.test?.sha256).toBe("abc123");
  });

  it("includes installed_targets in installed skill entry", () => {
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "test", "1.0.0", "hash1", ["SKILL.md", "references/guide.md"]);
    expect(updated.skills.test?.installed_targets).toEqual(["SKILL.md", "references/guide.md"]);
  });

  it("includes provenance in installed skill entry", () => {
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "test", "1.0.0", "hash2", [], "git:abc123def");
    expect(updated.skills.test?.provenance).toBe("git:abc123def");
  });
});

describe("verifyIntegrity", () => {
  it("returns empty diagnostics when all hashes match", () => {
    const content = "some content";
    const hash = computeSkillHash(content);
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "tdd-change", "1.0.0", hash);
    const skills = new Map([["tdd-change", content]]);
    const diags = verifyIntegrity(updated, skills);
    expect(diags).toHaveLength(0);
  });

  it("returns empty when skill has no sha256 (backward compat)", () => {
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "old-skill", "1.0.0");
    const skills = new Map([["old-skill", "anything"]]);
    const diags = verifyIntegrity(updated, skills);
    expect(diags).toHaveLength(0);
  });

  it("detects missing skill from lockfile", () => {
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "missing-skill", "1.0.0", "abc123");
    const skills = new Map<string, string>();
    const diags = verifyIntegrity(updated, skills);
    expect(diags.some((d) => d.code === "INTEGRITY_SKILL_NOT_FOUND")).toBe(true);
  });

  it("detects hash mismatch", () => {
    const content = "real content";
    const lock = createLockfile();
    const updated = addSkillToLockfile(lock, "test", "1.0.0", "wronghash");
    const skills = new Map([["test", content]]);
    const diags = verifyIntegrity(updated, skills);
    expect(diags.some((d) => d.code === "INTEGRITY_HASH_MISMATCH")).toBe(true);
  });
});
