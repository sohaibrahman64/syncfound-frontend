import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getChat, listMessages, sendMessage } from '../utils/chatApi';
import { appendCursorPage, createCursorState, dedupeById, prependCursorPage } from '../utils/chatPagination';
import { generateIdempotencyKey } from '../utils/idempotency';

const PAGE_LIMIT = 30;

function sortAscendingByCreatedAt(items = []) {
  return [...items].sort((a, b) => {
    const first = new Date(a?.createdAt || 0).getTime();
    const second = new Date(b?.createdAt || 0).getTime();
    return first - second;
  });
}

function mergeLocalPendingMessages(serverItems = [], localItems = []) {
  const localPending = (Array.isArray(localItems) ? localItems : []).filter((item) => (
    Boolean(item?.isOptimistic) || String(item?.sendState || '').toLowerCase() === 'failed'
  ));

  if (localPending.length === 0) {
    return sortAscendingByCreatedAt(serverItems);
  }

  const merged = [...(Array.isArray(serverItems) ? serverItems : [])];

  localPending.forEach((pendingItem) => {
    const pendingId = String(pendingItem?.messageId || '').trim();
    const pendingKey = String(pendingItem?.idempotencyKey || '').trim();

    const existsOnServer = merged.some((serverItem) => {
      const serverId = String(serverItem?.messageId || '').trim();
      const serverKey = String(serverItem?.idempotencyKey || '').trim();

      if (pendingId && pendingId === serverId) {
        return true;
      }

      if (pendingKey && serverKey && pendingKey === serverKey) {
        return true;
      }

      return false;
    });

    if (!existsOnServer) {
      merged.push(pendingItem);
    }
  });

  return sortAscendingByCreatedAt(merged);
}

export default function useChatThread({
  firebaseToken,
  conversationId,
  currentUserId = '',
  onAuthExpired,
  onAnalyticsEvent,
} = {}) {
  const [chat, setChat] = useState(null);
  const [messageState, setMessageState] = useState(() => ({
    ...createCursorState(),
    isLoading: false,
    isPaginating: false,
    isRefreshing: false,
    error: '',
  }));
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);

  const requestVersionRef = useRef(0);
  const sendingKeysRef = useRef(new Set());
  const messageStateRef = useRef(messageState);

  useEffect(() => {
    messageStateRef.current = messageState;
  }, [messageState]);

  const latestMessage = useMemo(() => {
    const items = Array.isArray(messageState.items) ? messageState.items : [];
    return items.length > 0 ? items[items.length - 1] : null;
  }, [messageState.items]);

  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      setChat(null);
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const controller = new AbortController();

    try {
      const payload = await getChat({
        firebaseToken,
        conversationId,
        signal: controller.signal,
      });

      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      setChat(payload);
      onAnalyticsEvent?.('chat_thread_opened', {
        conversation_id: conversationId,
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      if (error?.status === 401 || error?.status === 403) {
        onAuthExpired?.();
      }
    }

    return () => {
      controller.abort();
    };
  }, [conversationId, firebaseToken, onAnalyticsEvent, onAuthExpired]);

  const loadMessages = useCallback(async ({ refresh = false, paginate = false } = {}) => {
    if (!conversationId) {
      return;
    }

    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    const controller = new AbortController();

    setMessageState((prev) => ({
      ...prev,
      isLoading: !refresh && !paginate,
      isRefreshing: refresh,
      isPaginating: paginate,
      error: refresh ? '' : prev.error,
    }));

    try {
      const payload = await listMessages({
        firebaseToken,
        conversationId,
        currentUserId,
        limit: PAGE_LIMIT,
        cursor: paginate ? messageStateRef.current.nextCursor : null,
        signal: controller.signal,
      });

      if (requestVersionRef.current !== requestVersion) {
        return;
      }

      setMessageState((prev) => {
        const nextCursorState = paginate
          ? prependCursorPage(prev, sortAscendingByCreatedAt(payload.items), payload.nextCursor, payload.hasMore)
          : appendCursorPage(
            createCursorState(),
            mergeLocalPendingMessages(payload.items, prev.items),
            payload.nextCursor,
            payload.hasMore,
          );

        return {
          ...prev,
          ...nextCursorState,
          isLoading: false,
          isRefreshing: false,
          isPaginating: false,
          error: '',
        };
      });
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      if (error?.status === 401 || error?.status === 403) {
        onAuthExpired?.();
        return;
      }

      setMessageState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        isPaginating: false,
        error: error?.userMessage || error?.message || 'Could not load messages.',
      }));
    }

    return () => {
      controller.abort();
    };
  }, [conversationId, currentUserId, firebaseToken, onAuthExpired]);

  useEffect(() => {
    if (!conversationId) {
      setChat(null);
      setMessageState({
        ...createCursorState(),
        isLoading: false,
        isPaginating: false,
        isRefreshing: false,
        error: '',
      });
      return;
    }

    void loadConversation();
    void loadMessages({ refresh: true });
  }, [conversationId, loadConversation, loadMessages]);

  useEffect(() => () => {
    requestVersionRef.current += 1;
  }, []);

  const sendTextMessage = useCallback(async (messageText) => {
    const trimmedText = String(messageText || '').trim();
    if (!trimmedText) {
      return null;
    }

    if (trimmedText.length > 4000) {
      setSendError('Message must be under 4000 characters.');
      return null;
    }

    if (isSending) {
      return null;
    }

    const idempotencyKey = generateIdempotencyKey('chat-message');
    if (sendingKeysRef.current.has(idempotencyKey)) {
      return null;
    }

    sendingKeysRef.current.add(idempotencyKey);
    setIsSending(true);
    setSendError('');

    const optimisticMessage = {
      messageId: `optimistic-${idempotencyKey}`,
      conversationId,
      senderUserId: currentUserId,
      senderName: 'You',
      messageText: trimmedText,
      messageKind: 'text',
      createdAt: new Date().toISOString(),
      idempotencyKey,
      isMine: true,
      isOptimistic: true,
      sendState: 'sending',
    };

    setMessageState((prev) => ({
      ...prev,
      items: dedupeById(sortAscendingByCreatedAt([...(prev.items || []), optimisticMessage])),
    }));

    try {
      const serverMessage = await sendMessage({
        firebaseToken,
        conversationId,
        messageText: trimmedText,
        idempotencyKey,
        currentUserId,
      });

      setMessageState((prev) => ({
        ...prev,
        items: (() => {
          const nextItems = [];
          let replaced = false;

          (prev.items || []).forEach((item) => {
            if (item.idempotencyKey === idempotencyKey || item.messageId === optimisticMessage.messageId) {
              if (!replaced) {
                nextItems.push({
                  ...serverMessage,
                  isMine: true,
                });
                replaced = true;
              }
              return;
            }

            nextItems.push(item);
          });

          if (!replaced) {
            nextItems.push({
              ...serverMessage,
              isMine: true,
            });
          }

          return sortAscendingByCreatedAt(nextItems);
        })(),
      }));

      onAnalyticsEvent?.('chat_message_sent', {
        conversation_id: conversationId,
      });

      return serverMessage;
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) {
        onAuthExpired?.();
      }

      setSendError(error?.userMessage || error?.message || 'Could not send message.');
      setMessageState((prev) => ({
        ...prev,
        items: (prev.items || []).map((item) => {
          if (item.idempotencyKey === idempotencyKey || item.messageId === optimisticMessage.messageId) {
            return {
              ...item,
              sendState: 'failed',
            };
          }
          return item;
        }),
      }));
      return null;
    } finally {
      setIsSending(false);
      sendingKeysRef.current.delete(idempotencyKey);
    }
  }, [conversationId, currentUserId, firebaseToken, isSending, onAnalyticsEvent, onAuthExpired]);

  const loadOlderMessages = useCallback(() => {
    if (!messageState.hasMore || messageState.isPaginating || messageState.isLoading || messageState.isRefreshing) {
      return;
    }

    void loadMessages({ paginate: true });
  }, [loadMessages, messageState.hasMore, messageState.isLoading, messageState.isPaginating, messageState.isRefreshing]);

  const refreshThread = useCallback(() => {
    void loadMessages({ refresh: true });
  }, [loadMessages]);

  return {
    chat,
    messages: messageState.items,
    latestMessage,
    isLoading: messageState.isLoading,
    isRefreshing: messageState.isRefreshing,
    isPaginating: messageState.isPaginating,
    hasMore: messageState.hasMore,
    error: messageState.error,
    sendError,
    isSending,
    setSendError,
    sendTextMessage,
    loadOlderMessages,
    refreshThread,
  };
}
