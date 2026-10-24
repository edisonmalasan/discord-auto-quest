import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { QuestCompletion } from '../types/work';

const handlers = new Map<string, (event: {payload: unknown}) => void>();
const unlisten = vi.fn();
vi.mock('@tauri-apps/api/event', () => ({listen: vi.fn(async (name, handler) => {handlers.set(name, handler);return unlisten;})}));
const {useCompletions} = await import('./useCompletions');

it('shows a confirmed completion once, supports dismiss, and releases listeners', async()=>{
  const {result, unmount}=renderHook(()=>useCompletions());
  await waitFor(()=>expect(handlers.has('quest-completed')).toBe(true));
  const quest:QuestCompletion={questId:'123',name:'Example quest'};
  act(()=>handlers.get('quest-completed')!({payload:quest}));
  expect(result.current.completion).toEqual(quest);
  act(()=>result.current.dismissCompletion());
  act(()=>handlers.get('quest-completed')!({payload:quest}));
  expect(result.current.completion).toBeNull();
  unmount();expect(unlisten).toHaveBeenCalled();
});
