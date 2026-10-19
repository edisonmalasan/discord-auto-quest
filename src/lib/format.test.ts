import { describe, expect, it } from 'vitest';

import {
  formatAge,
  formatCount,
  formatPercent,
  notQuestableReason,
  pathBasename,
  pathSegments,
  platformLabel,
} from './format';

describe('formatCount', () => {
  it('groups thousands', () => {
    expect(formatCount(24725)).toBe('24,725');
    expect(formatCount(0)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('keeps one decimal place', () => {
    expect(formatPercent(0.4229)).toBe('42.3%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(1)).toBe('100.0%');
  });
});

describe('formatAge', () => {
  const now = 1_700_000_000_000;

  it('describes a fresh fetch', () => {
    expect(formatAge(1_699_999_990, now)).toBe('just now');
  });

  it('describes minutes, hours, and days', () => {
    expect(formatAge(1_699_999_940, now)).toBe('1 minute ago');
    expect(formatAge(1_699_999_820, now)).toBe('3 minutes ago');
    expect(formatAge(1_699_994_800, now)).toBe('1 hour ago');
    expect(formatAge(1_699_960_400, now)).toBe('11 hours ago');
    expect(formatAge(1_699_920_800, now)).toBe('22 hours ago');
    expect(formatAge(1_699_913_600, now)).toBe('1 day ago');
    expect(formatAge(1_691_372_800, now)).toBe('100 days ago');
  });

  it('says so when the age is unknown', () => {
    expect(formatAge(null, now)).toBe('unknown');
  });

  it('does not report a negative age for a clock that went backwards', () => {
    expect(formatAge(1_700_000_100, now)).toBe('just now');
  });
});

describe('pathSegments', () => {
  it('splits a registered path into its segments', () => {
    expect(pathSegments('_retail_/overwatch.exe')).toEqual(['_retail_', 'overwatch.exe']);
    expect(pathSegments('osx64/dota2.app')).toEqual(['osx64', 'dota2.app']);
  });

  it('ignores empty segments', () => {
    expect(pathSegments('//a//b//')).toEqual(['a', 'b']);
  });
});

describe('pathBasename', () => {
  it('returns the file at the end of the path', () => {
    expect(pathBasename('_retail_/overwatch.exe')).toBe('overwatch.exe');
    expect(pathBasename('overwatch.exe')).toBe('overwatch.exe');
  });
});

describe('platformLabel', () => {
  it('names the platforms the catalogue uses', () => {
    expect(platformLabel('win32')).toBe('Windows');
    expect(platformLabel('darwin')).toBe('macOS');
    expect(platformLabel('linux')).toBe('Linux');
  });

  it('passes an unknown platform through', () => {
    expect(platformLabel('haiku')).toBe('haiku');
  });
});

describe('notQuestableReason', () => {
  it('explains a title with no registered executable', () => {
    expect(notQuestableReason(0)).toContain('has not registered a launchable executable');
  });
});
