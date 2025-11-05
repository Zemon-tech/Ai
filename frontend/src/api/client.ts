const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let message = 'Request failed';
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; name?: string }) =>
      request<{ user: { id: string; email: string; name?: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    login: (body: { email: string; password: string }) =>
      request<{ user: { id: string; email: string; name?: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    refresh: () => request<{ ok: true }>('/auth/refresh', { method: 'POST' }),
    me: () => request<{ user: { id: string; email: string; name?: string } }>('/auth/me'),
  },
  conversations: {
    list: () => request<{ conversations: any[] }>('/conversations'),
    create: (title?: string) => request<{ conversation: any }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
    remove: (id: string) => request<{ ok: true }>(`/conversations/${id}`, { method: 'DELETE' }),
    rename: (id: string, title: string) => request<{ conversation: any }>(`/conversations/${id}/title`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
    messages: (id: string, page = 1, pageSize = 50) =>
      request<{ messages: any[] }>(`/conversations/${id}/messages?page=${page}&pageSize=${pageSize}`),
  },
  ai: {
    stream: (body: { conversationId?: string; message: string }, onDelta: (text: string) => void) => {
      const url = `${API_BASE}/ai/stream`;
      const es = new EventSource(url + '?_=' + Date.now(), { withCredentials: true } as any);
      // We cannot send body with EventSource; use fetch with SSE polyfill via text/event-stream is non-trivial in browser.
      // Use fetch and read stream manually instead.
      return fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (res) => {
        if (!res.ok || !res.body) throw new Error('Stream failed');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            if (part.startsWith('data: ')) {
              const payload = part.slice(6);
              try {
                const evt = JSON.parse(payload);
                if (evt.type === 'delta') onDelta(evt.delta as string);
              } catch {}
            }
          }
        }
        return true;
      });
    },
  },
};


