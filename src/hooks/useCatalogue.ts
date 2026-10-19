import { useCallback, useEffect, useRef, useState } from 'react';

import {
  loadCatalogue,
  onCatalogueRefreshFailed,
  onCatalogueUpdated,
  refreshCatalogue,
  toAppError,
} from '../lib/ipc';
import type { AppErrorShape, CatalogueSnapshot } from '../types/catalogue';

export type CatalogueStatus = 'loading' | 'ready' | 'error';

export interface CatalogueController {
  status: CatalogueStatus;
  snapshot: CatalogueSnapshot | null;
  /** The failure that stopped the catalogue from loading at all. */
  error: AppErrorShape | null;
  /** True while a refresh the visitor asked for is in flight. */
  refreshing: boolean;
  /** A refresh that failed. The catalogue on screen is still the cached copy. */
  refreshError: AppErrorShape | null;
  /** Fetch a fresh catalogue from Discord. */
  refresh: () => void;
  /** Try again after a failure. */
  retry: () => void;
}

/**
 * Owns the catalogue.
 *
 * The catalogue is backend state. It is loaded once on mount and then replaced only
 * when the backend says a newer copy exists, so the UI never asserts a state the
 * backend has not confirmed.
 */
export function useCatalogue(): CatalogueController {
  const [status, setStatus] = useState<CatalogueStatus>('loading');
  const [snapshot, setSnapshot] = useState<CatalogueSnapshot | null>(null);
  const [error, setError] = useState<AppErrorShape | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<AppErrorShape | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const loaded = await loadCatalogue();
      if (!mounted.current) {
        return;
      }
      setSnapshot(loaded);
      setStatus('ready');
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      setError(toAppError(failure));
      setStatus('error');
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const fresh = await refreshCatalogue();
      if (!mounted.current) {
        return;
      }
      setSnapshot(fresh);
      setStatus('ready');
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      setRefreshError(toAppError(failure));
    } finally {
      if (mounted.current) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const subscribe = async () => {
      try {
        const [stopUpdated, stopFailed] = await Promise.all([
          onCatalogueUpdated((updated) => {
            if (cancelled) {
              return;
            }
            setSnapshot(updated);
            setStatus('ready');
            setError(null);
          }),
          onCatalogueRefreshFailed((failure) => {
            if (cancelled) {
              return;
            }
            setRefreshError(failure);
          }),
        ]);
        if (cancelled) {
          stopUpdated();
          stopFailed();
          return;
        }
        unlisten = () => {
          stopUpdated();
          stopFailed();
        };
      } catch {
        // Outside the Tauri shell there is no event channel. The app still works;
        // it simply will not learn about a background refresh.
      }
    };

    void subscribe();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return {
    status,
    snapshot,
    error,
    refreshing,
    refreshError,
    refresh: () => {
      void refresh();
    },
    retry: () => {
      void load();
    },
  };
}
