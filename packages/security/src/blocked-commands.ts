import { createError, type Diagnostic } from "@strings77wzq/goalrun-core";

export function isCommandBlocked(command: string, blockedCommands: string[]): boolean {
  return blockedCommands.some((blocked) => command.startsWith(blocked));
}

export function scanForBlockedCommands(
  content: string,
  filePath: string,
  blockedCommands: string[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    for (const blocked of blockedCommands) {
      if (trimmed.includes(blocked)) {
        diagnostics.push(
          createError(
            "BLOCKED_COMMAND",
            `Blocked command "${blocked}" found`,
            {
              file: filePath,
              line: i + 1,
              hint: `This command matches a blocked pattern and must not be executed by GoalRun`,
            },
          ),
        );
        break;
      }
    }
  }

  return diagnostics;
}
