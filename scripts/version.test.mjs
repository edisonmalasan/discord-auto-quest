import { describe, expect, it } from 'vitest';

import { checkVersion, findDrift, readVersion, syncVersion } from './version.mjs';

describe('the version', () => {
  it('is defined in one place, and every manifest agrees with it', () => {
    const { version, drift } = findDrift();

    expect(drift).toEqual([]);
    expect(version).toBe(readVersion());
  });

  it('is a semver number', () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('passes its own check', () => {
    expect(() => checkVersion()).not.toThrow();
  });

  it('is what the manifests say after a sync', () => {
    const version = syncVersion();

    expect(version).toBe(readVersion());
    expect(findDrift().drift).toEqual([]);
  });
});
