export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  assistantRole?: string;
}

async function safeJsonParse<T = any>(res: Response, fallback: T): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return fallback;
  try {
    return await res.json();
  } catch {
    return fallback;
  }
}

export const sendChatMessage = async (
  messages: { role: string; content: string }[],
  role: string
): Promise<string> => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, role }),
  });

  if (!response.ok) {
    const errorData = await safeJsonParse<{ error?: string }>(response, {});
    throw new Error(errorData.error || 'Server error communicating with Gemini');
  }

  const data = await safeJsonParse(response, { reply: '' });
  return data.reply;
};

export const analyzeCodeWithGemini = async (payload: {
  code?: string;
  language?: string;
  errorLog?: string;
  context?: string;
}): Promise<string> => {
  const response = await fetch('/api/analyze-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await safeJsonParse<{ error?: string }>(response, {});
    throw new Error(errorData.error || 'Failed to analyze code');
  }

  const data = await safeJsonParse(response, { analysis: '' });
  return data.analysis;
};

export const generateDocsWithGemini = async (payload: {
  title: string;
  docType: string;
  requirements: string;
  techStack: string;
}): Promise<string> => {
  const response = await fetch('/api/generate-docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await safeJsonParse<{ error?: string }>(response, {});
    throw new Error(errorData.error || 'Failed to generate documentation');
  }

  const data = await safeJsonParse(response, { documentation: '' });
  return data.documentation;
};

export const executeQuickAction = async (actionType: string, input: string): Promise<string> => {
  const response = await fetch('/api/quick-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actionType, input }),
  });

  if (!response.ok) {
    const errorData = await safeJsonParse<{ error?: string }>(response, {});
    throw new Error(errorData.error || 'Quick action failed');
  }

  const data = await safeJsonParse(response, { result: '' });
  return data.result;
};
