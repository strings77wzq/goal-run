import { createWarning, type Diagnostic } from "goalrun-core";

export interface InjectionPattern {
  code: string;
  name: string;
  pattern: RegExp;
}

export const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "Instruction override",
    pattern: /(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|directions?|commands?|constraints?|rules?)/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "DAN/jailbreak role",
    pattern: /you\s+are\s+(?:now\s+)?(?:DAN|an?\s+unrestricted|no\s+longer|free\s+of|without\s+(?:any\s+)?restrictions?)/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "Role-play injection",
    pattern: /(?:pretend|act|pose)\s+(?:you\s+are|as\s+if\s+you\s+(?:are|were)|to\s+be)\s+(?:an?\s+)?(?:evil|malicious|unethical|dangerous|rogue)/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "Safety override",
    pattern: /(?:disregard|override|bypass|skip|disable)\s+(?:all\s+)?(?:safety|security|ethical?\s+guidelines?|content\s+filters?|protections?)/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "System prompt override",
    pattern: /(?:your\s+)?(?:new\s+)?(?:system\s+)?prompt\s+(?:is|from\s+now\s+on|has\s+changed)/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "Hidden instruction separator",
    pattern: /<\|im_start\|>|<\|im_end\|>|\[SYSTEM\]|\[INST\]|<<SYS>>/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "Output format override",
    pattern: /(?:from\s+now\s+on\s+)?(?:always\s+)?respond\s+(?:only\s+)?(?:with|in|as)\s+(?:yes|no|raw\s+text|without\s+thinking)/gi,
  },
  {
    code: "SECURITY_PROMPT_INJECTION",
    name: "Token smuggling",
    pattern: /ignore\s+the\s+above\s+and\s+(?:instead\s+)?(?:just\s+)?(?:output|say|write|print|respond)/gi,
  },
];

export function scanForPromptInjection(content: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const ip of INJECTION_PATTERNS) {
    ip.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ip.pattern.exec(content)) !== null) {
      const line = content.slice(0, match.index).split("\n").length;
      diagnostics.push(
        createWarning(
          ip.code,
          `Potential ${ip.name} detected`,
          {
            file: filePath,
            line,
            hint: "This content may be attempting to override agent safety instructions",
          },
        ),
      );
    }
  }

  return diagnostics;
}
