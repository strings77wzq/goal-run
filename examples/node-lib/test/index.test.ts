import { describe, it, expect } from 'vitest';
import { add, multiply, fibonacci } from '../src/index.js';

describe('node-lib', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('multiplies two numbers', () => {
    expect(multiply(4, 5)).toBe(20);
  });

  it('computes fibonacci', () => {
    expect(fibonacci(10)).toBe(55);
  });
});
