type RuntimeMarkDetails = Record<string, unknown>;

const getMarkStore = (): Record<string, boolean> => {
  const runtimeWindow = window as Window & {
    __skladRuntimeMarks?: Record<string, boolean>;
  };

  if (!runtimeWindow.__skladRuntimeMarks) {
    runtimeWindow.__skladRuntimeMarks = {};
  }

  return runtimeWindow.__skladRuntimeMarks;
};

export const markRuntimeOnce = (name: string, details?: RuntimeMarkDetails) => {
  if (typeof window === 'undefined') {
    return;
  }

  const markStore = getMarkStore();
  if (markStore[name]) {
    return;
  }

  markStore[name] = true;
  window.skladDesktop?.markRuntime?.(name, details);
};