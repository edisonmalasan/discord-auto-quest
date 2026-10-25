export interface WorkState {
  phase: 'stopped' | 'starting' | 'working' | 'waiting' | 'stopping' | 'paused';
  activeQuestId: string | null;
  activeTaskKind: string | null;
  queuedCount: number;
  pendingQuestIds: string[];
  skippedQuests: {questId: string; reason: 'manual_play' | 'desktop_required' | 'unsupported' | 'unavailable'}[];
  message: string | null;
}

export const stoppedWork = (): WorkState => ({
  phase: 'stopped', activeQuestId: null, activeTaskKind: null, queuedCount: 0, pendingQuestIds: [], skippedQuests: [], message: null,
});

export interface QuestCompletion { questId: string; name: string }
