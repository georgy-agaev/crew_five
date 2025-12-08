export type ChatRole = 'system' | 'user';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatClient {
  complete(messages: ChatMessage[]): Promise<string>;
}

