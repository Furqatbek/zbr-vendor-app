import { useState, useCallback } from 'react';

const MIN_REFRESH_MS = 800;

/**
 * Pull-to-refresh hook. Calls the provided async callback
 * and manages the refreshing state for RefreshControl.
 * Ensures the spinner is visible for at least MIN_REFRESH_MS.
 */
export function useRefresh(onRefresh?: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const delay = new Promise((r) => setTimeout(r, MIN_REFRESH_MS));
    try {
      await Promise.all([onRefresh?.(), delay]);
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, handleRefresh };
}
