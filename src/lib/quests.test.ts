import { describe, expect, it } from 'vitest';

import {
  awaitingClaim,
  awaitingUser,
  duration,
  ends,
  isFinished,
  needsUser,
  reward,
  requirement,
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

  it('says how long a quest takes, in a way a person can read', () => {
    expect(duration(900)).toBe('15 min');
    expect(duration(142)).toBe('2 min');
    expect(duration(42)).toBe('42s');
    expect(duration(0)).toBe('—');
  });

  it('says the reward, and says nothing when there is none', () => {
    expect(reward(quest())).toBe('700 Orbs');
    expect(reward(quest({ rewardOrbs: null }))).toBeNull();
  });

  it('says when a quest stops being available', () => {
    expect(ends(quest())).toMatch(/Oct/);
    expect(ends(quest({ expiresAt: null }))).toBe('—');
    expect(ends(quest({ expiresAt: 'not a date' }))).toBe('—');
  });

  it('knows a quest is finished only when Discord says it is', () => {
    expect(isFinished(quest({ state: 'completed' }))).toBe(true);
    expect(isFinished(quest({ state: 'claimed', progressSeconds: 900 }))).toBe(false);
  });

  it('knows a quest that needs the user before it can count', () => {
    expect(needsUser(quest())).toBe(false);
    expect(needsUser(quest({ tasks: ['STREAM_ON_DESKTOP'] }))).toBe(true);
    expect(needsUser(quest({ tasks: ['WATCH_VIDEO'] }))).toBe(true);
  });

  it('says what the user still has to do, and nothing when there is nothing', () => {
    expect(requirement(quest({ tasks: ['STREAM_ON_DESKTOP'] }))).toBe(
      'counts only while you are in a voice channel with somebody',
    );
    expect(requirement(quest({ tasks: ['PLAY_ACTIVITY'] }))).toBe(
      'counts only while you are in a voice channel',
    );
    expect(requirement(quest({ tasks: ['WATCH_VIDEO'] }))).toBe(
      'counts only while a video is playing',
    );
    expect(requirement(quest())).toBeNull();
  });

  it('finds the one that is waiting, in each sense', () => {
    const quests = [
      quest({ id: '1', state: 'claimed' }),
      quest({ id: '2', state: 'completed', name: 'Done one' }),
      quest({ id: '3', state: 'claimed', tasks: ['STREAM_ON_DESKTOP'], name: 'Stream one' }),
    ];

    expect(awaitingClaim(quests)?.name).toBe('Done one');
    expect(awaitingUser(quests)?.name).toBe('Stream one');
    expect(awaitingClaim([])).toBeNull();
    expect(awaitingUser([])).toBeNull();
  });

  it('names a quest whose reward can still be claimed, not one whose reward has gone', () => {
    const quests = [
      quest({
        id: '1',
        name: 'Gone one',
        state: 'completed',
        expiresAt: '2020-01-01T00:00:00+00:00',
      }),
      quest({
        id: '2',
        name: 'Claimable one',
        state: 'completed',
        expiresAt: '2099-01-01T00:00:00+00:00',
      }),
    ];

    expect(awaitingClaim(quests)?.name).toBe('Claimable one');
  });

  it('falls back to the finished quest when every reward has expired', () => {
    const quests = [
      quest({
        id: '1',
        name: 'Gone one',
        state: 'completed',
        expiresAt: '2020-01-01T00:00:00+00:00',
      }),
    ];

    expect(awaitingClaim(quests)?.name).toBe('Gone one');
  });
});
