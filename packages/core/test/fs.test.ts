import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  resolveSafe,
  readFileSafe,
  writeFileSafe,
  fileExists,
  ensureDir,
  readYamlSafe,
  copyFileSafe,
} from "../src/fs.js";

describe("safe filesystem utilities", () => {
  let repoRoot: string;

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "goalrun-fs-test-"));
    await ensureDir(repoRoot, "subdir");
  });

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true });
  });

  describe("resolveSafe", () => {
    it("resolves a path within repo root", () => {
      const resolved = resolveSafe(repoRoot, "subdir/file.txt");
      expect(resolved).toBe(join(repoRoot, "subdir/file.txt"));
    });

    it("resolves '.' as repo root", () => {
      expect(resolveSafe(repoRoot, ".")).toBe(repoRoot);
    });

    it("throws on path traversal via '..'", () => {
      expect(() => resolveSafe(repoRoot, "../etc/passwd")).toThrow(
        /outside repo root/i,
      );
    });

    it("throws on path traversal via nested '..'", () => {
      expect(() => resolveSafe(repoRoot, "subdir/../../../etc/passwd")).toThrow(
        /outside repo root/i,
      );
    });

    it("throws on absolute path outside repo", () => {
      expect(() => resolveSafe(repoRoot, "/etc/passwd")).toThrow(
        /outside repo root/i,
      );
    });

    it("rejects symlink traversal (path doesn't escape but includes ..)", () => {
      expect(() => resolveSafe(repoRoot, "foo/../bar/../../outside")).toThrow(
        /outside repo root/i,
      );
    });
  });

  describe("readFileSafe", () => {
    it("reads a file within repo root", async () => {
      await writeFile(join(repoRoot, "test.txt"), "hello");
      const content = await readFileSafe(repoRoot, "test.txt");
      expect(content).toBe("hello");
    });

    it("throws on path traversal read attempt", async () => {
      await expect(readFileSafe(repoRoot, "../secret.txt")).rejects.toThrow(
        /outside repo root/i,
      );
    });

    it("throws when file does not exist", async () => {
      await expect(readFileSafe(repoRoot, "nonexistent.txt")).rejects.toThrow();
    });
  });

  describe("writeFileSafe", () => {
    it("writes a file within repo root", async () => {
      await writeFileSafe(repoRoot, "output.txt", "data");
      const content = await readFileSafe(repoRoot, "output.txt");
      expect(content).toBe("data");
    });

    it("throws on path traversal write attempt", async () => {
      await expect(writeFileSafe(repoRoot, "../bad.txt", "evil")).rejects.toThrow(
        /outside repo root/i,
      );
    });

    it("writes into nested directory", async () => {
      await writeFileSafe(repoRoot, "subdir/nested.txt", "deep");
      expect(await readFileSafe(repoRoot, "subdir/nested.txt")).toBe("deep");
    });

    it("creates parent directories automatically", async () => {
      await writeFileSafe(repoRoot, "a/b/c/file.txt", "ok");
      expect(await readFileSafe(repoRoot, "a/b/c/file.txt")).toBe("ok");
    });
  });

  describe("fileExists", () => {
    it("returns true for existing file", async () => {
      await writeFile(join(repoRoot, "real.txt"), "x");
      expect(await fileExists(repoRoot, "real.txt")).toBe(true);
    });

    it("returns false for nonexistent file", async () => {
      expect(await fileExists(repoRoot, "nope.txt")).toBe(false);
    });

    it("throws on path traversal", async () => {
      await expect(fileExists(repoRoot, "../etc/passwd")).rejects.toThrow(
        /outside repo root/i,
      );
    });
  });

  describe("ensureDir", () => {
    it("creates a directory if it does not exist", async () => {
      await ensureDir(repoRoot, "newdir");
      expect(await fileExists(repoRoot, "newdir")).toBe(true);
    });

    it("is idempotent for existing directory", async () => {
      await ensureDir(repoRoot, "existing");
      await ensureDir(repoRoot, "existing");
      expect(await fileExists(repoRoot, "existing")).toBe(true);
    });

    it("throws on path traversal", async () => {
      await expect(ensureDir(repoRoot, "../escape")).rejects.toThrow(
        /outside repo root/i,
      );
    });
  });

  describe("readYamlSafe", () => {
    it("parses valid YAML", async () => {
      await writeFile(join(repoRoot, "config.yaml"), "key: value\nlist:\n  - a\n  - b");
      const result = await readYamlSafe<{ key: string; list: string[] }>(repoRoot, "config.yaml");
      expect(result).toEqual({ key: "value", list: ["a", "b"] });
    });

    it("throws on invalid YAML", async () => {
      await writeFile(join(repoRoot, "bad.yaml"), "{ invalid: yaml: here }");
      await expect(readYamlSafe(repoRoot, "bad.yaml")).rejects.toThrow();
    });

    it("throws on path traversal", async () => {
      await expect(readYamlSafe(repoRoot, "../secret.yaml")).rejects.toThrow(
        /outside repo root/i,
      );
    });
  });

  describe("copyFileSafe", () => {
    it("copies a file within repo root", async () => {
      await writeFile(join(repoRoot, "source.txt"), "copy me");
      await copyFileSafe(repoRoot, "source.txt", "dest.txt");
      expect(await readFileSafe(repoRoot, "dest.txt")).toBe("copy me");
    });

    it("throws on source path traversal", async () => {
      await expect(copyFileSafe(repoRoot, "../src.txt", "dest.txt")).rejects.toThrow(
        /outside repo root/i,
      );
    });

    it("throws on dest path traversal", async () => {
      await writeFile(join(repoRoot, "source.txt"), "data");
      await expect(copyFileSafe(repoRoot, "source.txt", "../dest.txt")).rejects.toThrow(
        /outside repo root/i,
      );
    });
  });
});
