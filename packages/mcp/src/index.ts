/**
 * GoalRun MCP Server — AI Agent Verification Layer.
 *
 * Exposes goalrun.verify as an MCP tool for AI coding agents.
 * Agents call it during implementation to verify code meets requirements.
 */

export { createServer, startServer } from './server.js';
export { runVerify } from './verify.js';
export type { VerifyInput, VerifyResponse, VerifyResult, VerifyError, Blocker } from './types.js';
