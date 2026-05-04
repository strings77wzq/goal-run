import { describe, it, expect } from "vitest";
import { scanForSecrets, SECRET_PATTERNS } from "../src/secret-scan.js";

describe("scanForSecrets", () => {
  it("returns empty array for clean content", () => {
    const result = scanForSecrets("hello world", "test.txt");
    expect(result).toHaveLength(0);
  });

  it("detects API key pattern (sk-...)", () => {
    const result = scanForSecrets("const key = 'sk-abc123xyz'", "config.ts");
    expect(result.length).toBeGreaterThan(0);
    const apiKeyDiag = result.find((d) => d.code === "SECRET_API_KEY");
    expect(apiKeyDiag).toBeDefined();
    expect(apiKeyDiag!.file).toBe("config.ts");
    // Message must NOT contain the actual secret value
    expect(apiKeyDiag!.message).not.toContain("sk-abc123xyz");
    expect(apiKeyDiag!.message).not.toContain("abc123xyz");
  });

  it("detects GitHub token pattern", () => {
    const result = scanForSecrets("GITHUB_TOKEN=ghp_1234567890abcdef", ".env");
    expect(result.some((d) => d.code === "SECRET_GITHUB_TOKEN")).toBe(true);
  });

  it("detects AWS key pattern", () => {
    const result = scanForSecrets("AKIAIOSFODNN7EXAMPLE", "creds.txt");
    expect(result.some((d) => d.code === "SECRET_AWS_KEY")).toBe(true);
  });

  it("detects generic password assignment", () => {
    const result = scanForSecrets('password = "hunter2"', "config.py");
    expect(result.some((d) => d.code === "SECRET_PASSWORD_ASSIGNMENT")).toBe(true);
  });

  it("detects private key header", () => {
    const content = "-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAA...";
    const result = scanForSecrets(content, "key.pem");
    expect(result.some((d) => d.code === "SECRET_PRIVATE_KEY")).toBe(true);
  });

  it("returns empty for benign password mentions", () => {
    const result = scanForSecrets("// remember to set your password", "readme.md");
    expect(result.filter((d) => d.code === "SECRET_PASSWORD_ASSIGNMENT")).toHaveLength(0);
  });

  it("does not print secret text in message", () => {
    const result = scanForSecrets("const TOKEN='sk-very-secret-value-12345'", "app.ts");
    for (const d of result) {
      expect(d.message).not.toContain("very-secret-value-12345");
      expect(d.message).not.toContain("sk-very");
    }
  });

  it("reports line number where secret is found", () => {
    const content = "line1\nTOKEN=ghp_abcdefghijklmnop\nline3";
    const result = scanForSecrets(content, ".env");
    const tokenDiag = result.find((d) => d.code === "SECRET_GITHUB_TOKEN");
    expect(tokenDiag?.line).toBe(2);
  });
});

describe("SECRET_PATTERNS", () => {
  it("all patterns have a code", () => {
    for (const p of SECRET_PATTERNS) {
      expect(p.code).toBeTruthy();
    }
  });

  it("all patterns have a name", () => {
    for (const p of SECRET_PATTERNS) {
      expect(p.name).toBeTruthy();
    }
  });
});
