import { describe, expect, it } from 'vitest';

import {
  expiry,
  fraction,
  isCounting,
  isFinished,
  remaining,
  requirement,
  reward,
  stateLabel,
  taskLabel,
} from './quests';
import type { QuestSummary } from '../types/quests';

function quest(overrides: Partial<QuestSummary> = {}): QuestSummary {
  return {
    id: '1',
    name: 'Deadzone Rogue 2',
    tasks: ['PLAY_ON_DESKTOP'],
    expiresAt: '2026-10-25T00:00:00+00:00',
    state: 'available',
    progressSeconds: 0,
    targetSeconds: 900,
    rewardOrbs: 700,
    ...overrides,
  };
}

describe('the quest vocabulary', () => {
  it('names a task in words, and falls back to Discord’s own name', () => {
    expect(taskLabel('PLAY_ON_DESKTOP')).toBe('Play on desktop');
    expect(taskLabel('WATCH_VIDEO_ON_MOBILE')).toBe('Watch a video on mobile');
    expect(taskLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });

  it('knows a quest is counting only while it is accepted and short of its target', () => {
    expect(isCounting(quest({ state: 'claimed', progressSeconds: 10 }))).toBe(true);
    expect(isCounting(quest({ state: 'claimed', progressSeconds: 900 }))).toBe(false);
    expect(isCounting(quest({ state: 'available', progressSeconds: 10 }))).toBe(false);
    expect(isCounting(quest({ state: 'completed', progressSeconds: 900 }))).toBe(false);
  });

  it('knows a quest is finished only when Discord says it is', () => {
    expect(isFinished(quest({ state: 'completed' }))).toBe(true);
    expect(isFinished(quest({ state: 'claimed', progressSeconds: 900 }))).toBe(false);
  });

  it('measures a quest as a fraction of its target, and never past it', () => {
    expect(fraction(quest({ progressSeconds: 450, targetSeconds: 900 }))).toBe(0.5);
    expect(fraction(quest({ progressSeconds: 2000, targetSeconds: 900 }))).toBe(1);
    expect(fraction(quest({ progressSeconds: 0, targetSeconds: 0 }))).toBe(0);
  });

  it('says what is left in a way a person can read', () => {
    expect(remaining(quest({ progressSeconds: 870, targetSeconds: 900 }))).toBe('30s left');
    expect(remaining(quest({ progressSeconds: 300, targetSeconds: 900 }))).toBe('10 min left');
    expect(remaining(quest({ targetSeconds: 0 }))).toBe('');
  });

  it('tells the user what a streaming quest still needs from them', () => {
    expect(
      requirement(quest({ state: 'claimed', tasks: ['STREAM_ON_DESKTOP'] })),
    ).toBe('Be in a voice channel with somebody while this counts.');

    expect(requirement(quest({ state: 'claimed', tasks: ['WATCH_VIDEO'] }))).toBe(
      'A video has to be playing for this to count.',
    );

    // A quest that has not been accepted needs nothing from the user yet.
    expect(requirement(quest({ state: 'available' }))).toBeNull();
  });

  it('says when a quest stops being available', () => {
    expect(expiry(quest())).toContain('ends');
    expect(expiry(quest({ expiresAt: null }))).toBeNull();
    expect(expiry(quest({ expiresAt: 'not a date' }))).toBeNull();
  });

  it('says the reward, and says nothing when there is none', () => {
    expect(reward(quest())).toBe('700 Orbs');
    expect(reward(quest({ rewardOrbs: null }))).toBeNull();
  });

  it('names the state of a quest', () => {
    expect(stateLabel('available')).toBe('On offer');
    expect(stateLabel('claimed')).toBe('Accepted');
    expect(stateLabel('completed')).toBe('Completed');
  });
});
