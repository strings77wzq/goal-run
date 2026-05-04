import { createWarning, type Diagnostic } from "goalrun-core";

const ALLOWED_DOMAINS = new Set([
  "github.com",
  "gitlab.com",
  "bitbucket.org",
  "npmjs.com",
  "nodejs.org",
  "typescriptlang.org",
  "pnpm.io",
  "vitest.dev",
  "eslint.org",
  "prettier.io",
]);

const EXTERNAL_URL_PATTERN = /https?:\/\/([^\s<>"{}|\\^`[\]]+)/gi;
const CURL_PATTERN = /curl\s+(-\S+\s+)*['""]?(https?:\/\/[^\s'""]+)/gi;
const WGET_PATTERN = /wget\s+(-\S+\s+)*['""]?(https?:\/\/[^\s'""]+)/gi;

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isAllowedDomain(domain: string): boolean {
  return ALLOWED_DOMAINS.has(domain) || domain.endsWith(".github.com") || domain.endsWith(".gitlab.io");
}

export function scanForExternalUrls(content: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  // Scan raw URLs
  EXTERNAL_URL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EXTERNAL_URL_PATTERN.exec(content)) !== null) {
    const url = match[0];
    const domain = extractDomain(url);
    if (domain && !isAllowedDomain(domain) && !seen.has(domain)) {
      seen.add(domain);
      const line = content.slice(0, match.index).split("\n").length;
      diagnostics.push(
        createWarning(
          "SECURITY_EXTERNAL_URL",
          `External URL reference to "${domain}" detected`,
          {
            file: filePath,
            line,
            hint: "External URLs in skills or goals may indicate data exfiltration or supply chain risk",
          },
        ),
      );
    }
  }

  // Scan curl commands
  CURL_PATTERN.lastIndex = 0;
  while ((match = CURL_PATTERN.exec(content)) !== null) {
    const url = match[2] ?? match[0];
    const domain = extractDomain(url);
    if (domain && !isAllowedDomain(domain) && !seen.has(domain)) {
      seen.add(domain);
      const line = content.slice(0, match.index).split("\n").length;
      diagnostics.push(
        createWarning("SECURITY_EXTERNAL_URL", `curl to external domain "${domain}" detected`, {
          file: filePath,
          line,
          hint: "curl commands to external domains may download and execute untrusted code",
        }),
      );
    }
  }

  // Scan wget commands
  WGET_PATTERN.lastIndex = 0;
  while ((match = WGET_PATTERN.exec(content)) !== null) {
    const url = match[2] ?? match[0];
    const domain = extractDomain(url);
    if (domain && !isAllowedDomain(domain) && !seen.has(domain)) {
      seen.add(domain);
      const line = content.slice(0, match.index).split("\n").length;
      diagnostics.push(
        createWarning("SECURITY_EXTERNAL_URL", `wget to external domain "${domain}" detected`, {
          file: filePath,
          line,
          hint: "wget commands to external domains may download untrusted code",
        }),
      );
    }
  }

  return diagnostics;
}
