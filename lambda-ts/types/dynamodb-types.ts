/**
 * SessionTable のアイテム
 */
export type SessionTableItem = {
  SessionId: string;
  SessionTitle?: string;
  SessionSummary?: string;
  // LangChain による自動生成のため型定義が不明
  History?: unknown[];
  IsEscalated?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
};

/**
 * UserTable のアイテム
 */
export type UserTableItem = {
  UserId: string;
  Email: string;
  DisplayName?: string;
  SessionIds?: Set<string>;
  EscalatedSessionIds?: Set<string>;
  Inviter?: string;
};
