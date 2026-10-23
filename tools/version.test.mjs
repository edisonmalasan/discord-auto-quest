import { describe, expect, it } from 'vitest';

import { checkVersion, findDrift, readVersion, syncVersion, validVersion, verifyTag, compareVersions } from './version.mjs';

it('validates complete versions and numeric prerelease ordering', () => {
  for (const value of ['0.2.0-beta.1','1.0.0','2.3.4+build.7']) expect(validVersion(value)).toBe(true);
  for (const value of ['1.2.3oops','01.2.3','1.2','1.2.3-beta.01','1.2.3-','v1.2.3','1.2.3\n']) expect(validVersion(value)).toBe(false);
  expect(compareVersions('0.2.0-beta.2','0.2.0-beta.10')).toBeLessThan(0);
  expect(compareVersions('0.2.0-beta.10','0.2.0')).toBeLessThan(0);
  expect(compareVersions('1.0.0+a','1.0.0+b')).toBe(0);
  expect(() => verifyTag('v0.2.0-beta.1','0.2.0-beta.1')).not.toThrow();
  expect(() => verifyTag('v0.2.0','0.2.0-beta.1')).toThrow();
});

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
