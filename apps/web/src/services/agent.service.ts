import type { Conversation, Message } from '@monorepo/shared';

const BASE_URL = '/agent';

export const agentService = {
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch(`${BASE_URL}/conversations`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return data.conversations || [];
  },

  async getConversation(sessionId: string): Promise<{ success: boolean; messages: any[]; title?: string; summary?: string }> {
    const res = await fetch(`${BASE_URL}/conversation/${sessionId}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  },

  async deleteConversation(sessionId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/conversation/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  },

  async chatSSE(message: string, sessionId: string): Promise<Response> {
    return await fetch(`${BASE_URL}/chat/sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
    });
  },
};

export const formatMessages = (messagesData: any[], sessionId: string): Message[] => {
  return messagesData.map((msg: any, index: number) => ({
    id: `msg-${sessionId}-${index}`,
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
  }));
};