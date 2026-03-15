const listeners = new Set<() => void>();

export function notifyDiscoveryShouldRefresh() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('Discovery refresh listener failed', error);
    }
  });
}

export function subscribeToDiscoveryRefresh(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
