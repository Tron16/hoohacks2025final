export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  created_at: string;
}

export interface UserResponse {
  user: User;
}

export interface TranscriptMessage {
  text: string;
  isUser: boolean;
  timestamp: string | Date;
}

export interface CallHistoryItem {
  id: number;
  userId: number;
  phoneNumber: string;
  status: string;
  voiceModel: string;
  speechSpeed: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  muted?: boolean;
  transcript?: TranscriptMessage[];
  summary?: string;
}

export interface CallHistoryResponse {
  calls: CallHistoryItem[];
}

export interface CallStartResponse {
  callSid: string;
  status: string;
}