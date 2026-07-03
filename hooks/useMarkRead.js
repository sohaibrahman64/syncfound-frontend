import { useCallback, useRef } from 'react';
import { markRead } from '../utils/chatApi';

export default function useMarkRead({ firebaseToken, onAuthExpired, onError, onSuccess } = {}) {
  const inFlightByConversationRef = useRef(new Map());
  const lastSentByConversationRef = useRef(new Map());

  const mutate = useCallback(async ({ conversationId, lastReadMessageId } = {}) => {
    const key = `${conversationId || ''}:${lastReadMessageId || ''}`;
    if (!conversationId || !lastReadMessageId) {
      return null;
    }

    const lastSentMessageId = lastSentByConversationRef.current.get(conversationId);
    if (lastSentMessageId && lastSentMessageId === lastReadMessageId) {
      return null;
    }

    if (inFlightByConversationRef.current.has(key)) {
      return null;
    }

    lastSentByConversationRef.current.set(conversationId, lastReadMessageId);

    const promise = markRead({
      firebaseToken,
      conversationId,
      lastReadMessageId,
    })
      .then((payload) => {
        onSuccess?.(payload);
        return payload;
      })
      .catch((error) => {
        if (error?.status === 401 || error?.status === 403) {
          onAuthExpired?.();
          return null;
        }

        if (lastSentByConversationRef.current.get(conversationId) === lastReadMessageId) {
          lastSentByConversationRef.current.delete(conversationId);
        }

        onError?.(error);
        return null;
      })
      .finally(() => {
        inFlightByConversationRef.current.delete(key);
      });

    inFlightByConversationRef.current.set(key, promise);
    return promise;
  }, [firebaseToken, onAuthExpired, onError, onSuccess]);

  return {
    markAsRead: mutate,
  };
}
