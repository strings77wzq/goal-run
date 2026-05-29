import { describe, it, expect } from 'vitest';
import { detectEcosystem, generateBootstrapPlan } from '../src/ecosystem.js';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('detectEcosystem', () => {
  it('detects missing components in empty directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    const result = detectEcosystem(dir);

    expect(result.superpowers).toBe(false);
    expect(result.omc).toBe(false);
    expect(result.openspec).toBe(false);
    expect(result.gstack).toBe(false);
    expect(result.ecc).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('detects OpenSpec when openspec/ directory exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    mkdirSync(join(dir, 'openspec'), { recursive: true });

    const result = detectEcosystem(dir);
    expect(result.openspec).toBe(true);
  });

  it('detects OMC when .omc directory exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goalrun-test-'));
    mkdirSync(join(dir, '.omc'), { recursive: true });

    const result = detectEcosystem(dir);
    expect(result.omc).toBe(true);
  });
});

describe('generateBootstrapPlan', () => {
  it('generates actions for all missing components', () => {
    const detection = {
      superpowers: false,
      omc: false,
      openspec: false,
      gstack: false,
      ecc: false,
      diagnostics: [],
    };

    const plan = generateBootstrapPlan(detection);
    expect(plan.missing).toHaveLength(5);
    expect(plan.actions).toHaveLength(5);
    expect(plan.actions.some((a) => a.component === 'superpowers')).toBe(true);
    expect(plan.actions.some((a) => a.component === 'omc')).toBe(true);
  });

  it('returns empty plan when all components installed', () => {
    const detection = {
      superpowers: true,
      omc: true,
      openspec: true,
      gstack: true,
      ecc: true,
      diagnostics: [],
    };

    const plan = generateBootstrapPlan(detection);
    expect(plan.missing).toHaveLength(0);
    expect(plan.actions).toHaveLength(0);
  });

  it('marks superpowers and omc as required', () => {
    const detection = {
      superpowers: false,
      omc: false,
      openspec: true,
      gstack: true,
      ecc: true,
      diagnostics: [],
    };

    const plan = generateBootstrapPlan(detection);
    const superpowersAction = plan.actions.find((a) => a.component === 'superpowers');
    const omcAction = plan.actions.find((a) => a.component === 'omc');

    expect(superpowersAction?.priority).toBe('required');
    expect(omcAction?.priority).toBe('required');
  });
});
