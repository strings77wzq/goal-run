/**
 * GoalRun MCP Server — exposes goalrun.verify as an MCP tool.
 *
 * Uses @modelcontextprotocol/sdk with stdio transport.
 * Each verify call creates fresh harness context (stateless).
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { runVerify } from './verify.js';

/** Create and configure the MCP server */
export function createServer(projectRoot: string): McpServer {
  const server = new McpServer({
    name: 'goalrun',
    version: '0.1.0',
  });

  // Register goalrun.verify tool
  server.tool(
    'goalrun-verify',
    'Verify that code changes meet goal requirements. Returns structured pass/fail with blockers, next actions, and fix guidance.',
    {
      goalFile: z
        .string()
        .describe('Relative path to goal YAML file (e.g., ".goalrun/goals/sdd-tdd-workflow.yaml")'),
      changedFiles: z
        .array(z.string())
        .optional()
        .describe('Files modified since last commit. If omitted, derived from git diff.'),
    },
    async ({ goalFile, changedFiles }) => {
      const result = await runVerify({ goalFile, changedFiles }, projectRoot);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );

  return server;
}

/** Start the MCP server with stdio transport */
export async function startServer(projectRoot: string): Promise<void> {
  const server = createServer(projectRoot);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
