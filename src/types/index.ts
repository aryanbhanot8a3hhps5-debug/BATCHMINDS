export interface Batch {
  id: string;
  name: string;
  university: string;
  invite_code: string;
  created_at: string;
}

export interface Note {
  id: string;
  batch_id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  subject: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  embedding?: number[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { id: string; title: string }[];
  type?: 'text' | 'flashcards' | 'quiz' | 'summary';
  data?: any;
}

export interface Profile {
  id: string;
  display_name: string;
  credibility_score: number;
}

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  read: boolean;
}
