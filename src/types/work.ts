export interface WorkState {
  phase: 'stopped' | 'starting' | 'working' | 'waiting' | 'stopping' | 'paused';
  activeQuestId: string | null;
  activeTaskKind: string | null;
  queuedCount: number;
  message: string | null;
}

export const stoppedWork = (): WorkState => ({
  phase: 'stopped', activeQuestId: null, activeTaskKind: null, queuedCount: 0, message: null,
});

export interface QuestCompletion { questId: string; name: string }
