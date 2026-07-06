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

const readNestedErrorPayloadMessage = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const asRecord = value as Record<string, unknown>;

  if (typeof asRecord['error'] === 'string' && asRecord['error'].trim()) {
    return asRecord['error'].trim();
  }

  if (asRecord['error'] && typeof asRecord['error'] === 'object') {
    const nested = asRecord['error'] as Record<string, unknown>;
    if (typeof nested['message'] === 'string' && nested['message'].trim()) {
      return nested['message'].trim();
    }
    if (typeof nested['error'] === 'string' && nested['error'].trim()) {
      return nested['error'].trim();
    }
  }

  return null;
};

const sanitizeHttpNoise = (message: string): string => {
  const trimmed = String(message || '').trim();
  if (!trimmed) return trimmed;

  const httpFailurePattern = /^http failure response for\s+.*?:\s*\d+\s+[a-z ]+$/i;
  if (httpFailurePattern.test(trimmed)) {
    return '';
  }

  const noUrl = trimmed.replace(/https?:\/\/\S+/gi, '').trim();
  return noUrl.replace(/\s{2,}/g, ' ');
};

const normalizeStatusMessage = (status: number | undefined, fallback: string): string => {
  if (!status || status <= 0) {
    return 'Cannot reach server. Please check your connection and try again.';
  }

  if (status === 400) return fallback || 'Please check the information entered and try again.';
  if (status === 401) return 'Incorrect credentials or expired session. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'Requested record was not found.';
  if (status === 409) return fallback || 'This action conflicts with existing data.';
  if (status === 429) return fallback || 'Too many attempts. Please wait a bit and try again.';
  if (status >= 500) return fallback || 'Server error. Please try again.';

  return fallback || 'Request failed. Please try again.';
};

export const getErrorMessage = (error: unknown, fallback = 'Something went wrong'): string => {
  if (typeof error === 'string' && error.trim()) {
    const sanitized = sanitizeHttpNoise(error);
    return sanitized || fallback;
  }

  if (error && typeof error === 'object') {
    const asRecord = error as Record<string, unknown>;
    const status = typeof asRecord['status'] === 'number' ? asRecord['status'] : undefined;

    const nestedPayloadMessage = readNestedErrorPayloadMessage(error);
    if (nestedPayloadMessage) {
      const sanitized = sanitizeHttpNoise(nestedPayloadMessage);
      if (sanitized) return sanitized;
    }

    const objectMessage = readObjectMessage(error);
    if (objectMessage) {
      const sanitized = sanitizeHttpNoise(objectMessage);
      if (sanitized) return sanitized;
    }

    if (error instanceof Error && error.message.trim()) {
      const sanitized = sanitizeHttpNoise(error.message);
      if (sanitized) return sanitized;
    }

    return normalizeStatusMessage(status, fallback);
  }

  if (error instanceof Error && error.message.trim()) {
    const sanitized = sanitizeHttpNoise(error.message);
    return sanitized || fallback;
  }

  return fallback;
};
