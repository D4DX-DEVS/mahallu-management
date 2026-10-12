import api from './api';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantAnswer {
  answer: string;
  /** Questions left today for this user (server-enforced daily limit). */
  remaining?: number;
  toolsUsed: string[];
  model: string;
}

export const assistantService = {
  ask: async (question: string, history: AssistantTurn[] = []) => {
    const response = await api.post<{ success: boolean; data: AssistantAnswer }>('/assistant/query', {
      question,
      history,
    });
    return response.data.data;
  },
};
