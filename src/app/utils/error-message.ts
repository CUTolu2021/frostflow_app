const readObjectMessage = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const asRecord = value as Record<string, unknown>;

  if (typeof asRecord['message'] === 'string' && asRecord['message'].trim()) {
    return asRecord['message'];
  }

  if (asRecord['error'] && typeof asRecord['error'] === 'object') {
    const nested = asRecord['error'] as Record<string, unknown>;
    if (typeof nested['message'] === 'string' && nested['message'].trim()) {
      return nested['message'];
    }
  }

  return null;
};

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;

  const objectMessage = readObjectMessage(error);
  if (objectMessage) return objectMessage;

  return fallback;
};
