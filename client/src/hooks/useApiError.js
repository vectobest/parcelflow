import { useCallback } from 'react';
import { ApiError, OfflineError } from '../api/client.js';
import { useToast } from '../state/ToastContext.jsx';

/** Translates a thrown API error into a business-language toast (master prompt section 11: no raw HTTP codes shown to operators). */
export function useApiError() {
  const toast = useToast();
  return useCallback((error, context) => {
    if (error instanceof OfflineError) {
      toast(`${context}: the server could not be reached. No changes were made.`, 'error');
      return;
    }
    if (error instanceof ApiError && error.status === 401) {
      toast(`${context}: your session expired. Please sign in again.`, 'error');
      return;
    }
    if (error instanceof ApiError && error.status === 403) {
      toast(`${context}: your role isn't allowed to do this.`, 'error');
      return;
    }
    toast(`${context}: ${error.message}`, 'error');
  }, [toast]);
}
