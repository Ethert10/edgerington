import { ReactNode } from 'react';

export enum Role {
  User = 'user',
  Model = 'model'
}

export interface Attachment {
  mimeType: string;
  data: string; // base64
  name?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: number;
  isThinking?: boolean;
  attachment?: Attachment; // User uploaded
  generatedImage?: string; // Model generated (base64)
  groundingChunks?: GroundingChunk[]; // Search results
  executableCode?: {
    code: string;
    language: string;
  };
  codeExecutionResult?: {
    outcome: string;
    output: string;
  };
}

export type ChatMode = 'persona' | 'homework';

export interface ChatSession {
  id: string;
  title: string;
  lastMessageTime: number;
  mode: ChatMode;
}

export interface Suggestion {
  label: string;
  prompt: string;
  icon?: ReactNode;
}