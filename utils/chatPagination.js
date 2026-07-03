function normalizeCursor(value) {
  const text = String(value || '').trim();
  return text || null;
}

export function createCursorState() {
  return {
    items: [],
    nextCursor: null,
    hasMore: true,
  };
}

export function appendCursorPage(currentState, incomingItems, nextCursor, hasMore) {
  const currentItems = Array.isArray(currentState?.items) ? currentState.items : [];
  const merged = dedupeById([...currentItems, ...(Array.isArray(incomingItems) ? incomingItems : [])]);

  return {
    items: merged,
    nextCursor: normalizeCursor(nextCursor),
    hasMore: typeof hasMore === 'boolean' ? hasMore : Boolean(nextCursor),
  };
}

export function prependCursorPage(currentState, incomingItems, nextCursor, hasMore) {
  const currentItems = Array.isArray(currentState?.items) ? currentState.items : [];
  const merged = dedupeById([...(Array.isArray(incomingItems) ? incomingItems : []), ...currentItems]);

  return {
    items: merged,
    nextCursor: normalizeCursor(nextCursor),
    hasMore: typeof hasMore === 'boolean' ? hasMore : Boolean(nextCursor),
  };
}

export function dedupeById(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = String(item?.messageId || item?.conversationId || item?.id || '').trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
