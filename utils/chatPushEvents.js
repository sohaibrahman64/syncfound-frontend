const listeners = new Set();

export function subscribeToChatPushEvents(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitChatPushEvent(event) {
  if (!event || typeof event !== 'object') {
    return;
  }

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // Ignore listener errors so one subscriber cannot break others.
    }
  });
}
