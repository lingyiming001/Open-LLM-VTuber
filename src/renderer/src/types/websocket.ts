import { ModelInfo } from './live2d';

export interface ConfigFile {
  filename: string;
  name: string;
}

export interface HistoryInfo {
  uid: string;
  latest_message: { role: 'human' | 'ai'; timestamp: string; content: string } | null;
  timestamp: string | null;
}

export interface DisplayText {
  text: string;
  name: string;
  avatar: string;
}

export interface Message {
  id: string;
  content: string;
  role: 'ai' | 'human';
  timestamp: string;
  name?: string;
  avatar?: string;
  type?: 'text' | 'tool_call_status';
  tool_id?: string;
  tool_name?: string;
  status?: 'running' | 'completed' | 'error';
}

export interface WebSocketMessage {
  type: string;
  text?: string;
  content?: string;
  timestamp?: string;
  client_uid?: string;
  conf_name?: string;
  conf_uid?: string;
  model_info?: ModelInfo;
  backendSynthComplete?: boolean;
}
