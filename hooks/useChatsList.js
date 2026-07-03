import { useCallback, useEffect, useRef, useState } from 'react';
import { listChats } from '../utils/chatApi';
import { appendCursorPage, createCursorState } from '../utils/chatPagination';

const PAGE_LIMIT = 20;

export default function useChatsList({ firebaseToken, onAuthExpired, onAnalyticsEvent } = {}) {
  const [state, setState] = useState(() => ({
    ...createCursorState(),
    isLoading: false,
    isRefreshing: false,
    isPaginating: false,
    error: '',
  }));

  const requestVersionRef = useRef(0);
  const debounceTimerRef = useRef(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyIfLatest = useCallback((requestVersion, updater) => {
    if (requestVersionRef.current !== requestVersion) {
      return;
    }

    setState((prev) => updater(prev));
  }, []);

  const runListRequest = useCallback(async ({ refresh = false, paginate = false, debounceMs = 0 } = {}) => {
    const execute = async () => {
      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      const controller = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: !refresh && !paginate,
        isRefreshing: refresh,
        isPaginating: paginate,
        error: refresh ? '' : prev.error,
      }));

      try {
        const payload = await listChats({
          firebaseToken,
          limit: PAGE_LIMIT,
          cursor: paginate ? stateRef.current.nextCursor : null,
          signal: controller.signal,
        });

        applyIfLatest(requestVersion, (prev) => {
          const nextState = paginate
            ? appendCursorPage(prev, payload.items, payload.nextCursor, payload.hasMore)
            : {
              items: payload.items,
              nextCursor: payload.nextCursor,
              hasMore: payload.hasMore,
            };

          return {
            ...prev,
            ...nextState,
            isLoading: false,
            isRefreshing: false,
            isPaginating: false,
            error: '',
          };
        });

        onAnalyticsEvent?.('chat_list_opened', {
          items_count: Array.isArray(payload?.items) ? payload.items.length : 0,
          refresh,
          paginate,
        });
      } catch (error) {
        if (error?.name === 'AbortError') {
          return;
        }

        if (error?.status === 401 || error?.status === 403) {
          onAuthExpired?.();
          return;
        }

        applyIfLatest(requestVersion, (prev) => ({
          ...prev,
          isLoading: false,
          isRefreshing: false,
          isPaginating: false,
          error: error?.userMessage || error?.message || 'Could not load chats.',
        }));
      }

      return () => {
        controller.abort();
      };
    };

    if (debounceMs > 0) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void execute();
      }, debounceMs);
      return;
    }

    await execute();
  }, [applyIfLatest, firebaseToken, onAnalyticsEvent, onAuthExpired]);

  useEffect(() => {
    return () => {
      requestVersionRef.current += 1;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const loadInitial = useCallback(() => runListRequest({ refresh: false, paginate: false }), [runListRequest]);
  const refresh = useCallback(() => runListRequest({ refresh: true, paginate: false, debounceMs: 220 }), [runListRequest]);
  const loadMore = useCallback(() => {
    if (!state.hasMore || state.isPaginating || state.isLoading || state.isRefreshing) {
      return;
    }

    void runListRequest({ paginate: true });
  }, [runListRequest, state.hasMore, state.isLoading, state.isPaginating, state.isRefreshing]);

  const patchConversation = useCallback((conversationId, patch) => {
    if (!conversationId || !patch || typeof patch !== 'object') {
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => (
        item.conversationId === conversationId ? { ...item, ...patch } : item
      )),
    }));
  }, []);

  return {
    ...state,
    loadInitial,
    refresh,
    loadMore,
    patchConversation,
  };
}
