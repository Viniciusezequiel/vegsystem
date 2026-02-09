import React from 'react';

interface ImagePrefetchState {
  total: number;
  loaded: number;
  isComplete: boolean;
}

// Simple state store for image prefetch progress
let state: ImagePrefetchState = {
  total: 0,
  loaded: 0,
  isComplete: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

export function setImagePrefetchProgress(loaded: number, total: number) {
  state = {
    ...state,
    loaded,
    total,
    isComplete: total > 0 && loaded >= total,
  };
  notify();
}

export function resetImagePrefetchProgress() {
  state = {
    ...state,
    total: 0,
    loaded: 0,
    isComplete: false,
  };
  notify();
}

export function useImagePrefetchProgress() {
  const [, forceUpdate] = React.useState({});

  React.useEffect(() => {
    const listener = () => forceUpdate({});
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    total: state.total,
    loaded: state.loaded,
    isComplete: state.isComplete,
    percentage: state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0,
  };
}
