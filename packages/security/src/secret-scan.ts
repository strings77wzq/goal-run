import { createWarning, type Diagnostic } from "goalrun-core";

export interface SecretPattern {
  code: string;
  name: string;
  pattern: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { code: "SECRET_API_KEY", name: "API key", pattern: /(?:sk|api[_-]?key)[-=:'"]\s*['""]?[a-zA-Z0-9_-]{8,}/gi },
  { code: "SECRET_GITHUB_TOKEN", name: "GitHub token", pattern: /(?:gh[pousr]_[A-Za-z0-9_]{10,})/g },
  { code: "SECRET_NPM_TOKEN", name: "npm token", pattern: /npm_[A-Za-z0-9]{36}/g },
  { code: "SECRET_AWS_KEY", name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/g },
  { code: "SECRET_GCP_KEY", name: "GCP service account key", pattern: /"type":\s*"service_account"/g },
  { code: "SECRET_SLACK_WEBHOOK", name: "Slack webhook", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/]+/gi },
  { code: "SECRET_PRIVATE_KEY", name: "Private key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { code: "SECRET_PASSWORD_ASSIGNMENT", name: "Password assignment", pattern: /(?:password|passwd|pwd|secret)\s*[:=]\s*['""][^'""]{3,}['""]/gi },
  { code: "SECRET_BEARER_TOKEN", name: "Bearer token", pattern: /Bearer\s+[A-Za-z0-9_\-.]{20,}/g },
  { code: "SECRET_JWT_TOKEN", name: "JWT token", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { code: "SECRET_CONNECTION_STRING", name: "Connection string", pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^'"\s]{10,}/gi },
  { code: "SECRET_GENERIC_SECRET", name: "Generic secret key", pattern: /(?:secret[_-]?key|secretKey|SECRET_KEY)\s*[:=]\s*['""][^'""]{8,}['""]/g },
];

export function scanForSecrets(content: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const secretPattern of SECRET_PATTERNS) {
    secretPattern.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = secretPattern.pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split("\n").length;
      diagnostics.push(
        createWarning(
          secretPattern.code,
          `Potential ${secretPattern.name} detected`,
          {
            file: filePath,
            line,
            hint: `Found a pattern matching ${secretPattern.name}. Do not commit secrets to version control.`,
          },
        ),
      );
    }
  }

  return diagnostics;
}
