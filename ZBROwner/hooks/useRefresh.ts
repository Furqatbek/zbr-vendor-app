import { useState, useCallback } from 'react';

/**
 * Pull-to-refresh hook. Calls the provided async callback
 * and manages the refreshing state for RefreshControl.
 */
export function useRefresh(onRefresh?: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  return { refreshing, handleRefresh };
}
