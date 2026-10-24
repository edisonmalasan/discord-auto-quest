export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'installing' | 'up-to-date' | 'error';
  installed: boolean;
  currentVersion: string;
  version: string | null;
  notes: string | null;
  progress: number | null;
  message: string | null;
}

export interface NotificationPreferences { enabled: boolean; installed: boolean }
