import type { CardRow } from '../types';

type CardRecord = CardRow & { added_by_ai: boolean; sort_order: number; created_at: string };
type ProgressRecord = { user_id: string; card_id: string; right_count: number; wrong_count: number; streak: number; last_seen: string };
type ProfileRecord = { id: string; email: string | null; role: 'user' | 'admin'; created_at: string };
type Table<Row, Insert> = { Row: { [Key in keyof Row]: Row[Key] }; Insert: { [Key in keyof Insert]: Insert[Key] }; Update: Partial<Row>; Relationships: [] };

/** Mirrors schema.sql; no service-role key is used by the client. */
export interface Database {
  public: {
    Tables: {
      cards: Table<CardRecord, Pick<CardRecord, 'id' | 'category' | 'ko' | 'fr' | 'sort_order'> & Partial<CardRecord>>;
      user_progress: Table<ProgressRecord, Pick<ProgressRecord, 'card_id'> & Partial<ProgressRecord>>;
      profiles: Table<ProfileRecord, Pick<ProfileRecord, 'id'> & Partial<ProfileRecord>>;
    };
    Views: { [key in never]: never };
    Functions: { [key in never]: never };
    Enums: { [key in never]: never };
    CompositeTypes: { [key in never]: never };
  };
}
