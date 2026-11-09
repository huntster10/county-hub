/**
 * Hand-written TypeScript types that mirror supabase/migrations/0001_init.sql.
 *
 * Tip: once your Supabase project exists you can regenerate this file with
 *   npx supabase gen types typescript --project-id <id> > src/lib/types/database.ts
 * but the hand-written version below is enough to get going.
 */

export type AppRole = "owner" | "admin" | "staff" | "department_leader" | "member";
export type ChannelType = "text" | "announcement" | "dm";
export type MemberStatus = "active" | "loa" | "inactive" | "suspended";
export type ShiftStatus = "active" | "on_break" | "ended";
export type PunishmentType = "warning" | "kick" | "ban" | "note" | "bolo";
export type ApplicationStatus = "pending" | "accepted" | "denied";
export type SessionStatus = "scheduled" | "active" | "ended";
export type CadStatus = "pending" | "dispatched" | "on_scene" | "resolved" | "cancelled";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Profile {
  id: string;
  roblox_id: number | null;
  roblox_username: string;
  roblox_display_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  bio: string | null;
  dashboard_layout: DashboardLayout | null;
  verified_at: string | null;
  is_dev_account: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardLayout {
  /** Widget ids in display order. */
  order: string[];
  /** Widget ids that are hidden. */
  hidden: string[];
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  icon: string;
  leader_id: string | null;
  quota_minutes: number;
  position: number;
  created_at: string;
}

export interface DepartmentRank {
  id: string;
  department_id: string;
  name: string;
  level: number;
  created_at: string;
}

export interface DepartmentMember {
  id: string;
  department_id: string;
  profile_id: string;
  rank_id: string | null;
  callsign: string | null;
  status: MemberStatus;
  joined_at: string;
}

export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
  department_id: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  category_id: string | null;
  department_id: string | null;
  name: string;
  slug: string;
  topic: string | null;
  type: ChannelType;
  is_private: boolean;
  min_role: AppRole | null;
  position: number;
  created_by: string | null;
  created_at: string;
}

export interface Attachment {
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: string;
  image?: string;
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string | null;
  content: string;
  attachments: Attachment[];
  embeds: Embed[];
  mentions: string[];
  reply_to_id: string | null;
  pinned: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface MessageReaction {
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

export interface Shift {
  id: string;
  profile_id: string;
  department_id: string | null;
  status: ShiftStatus;
  started_at: string;
  ended_at: string | null;
  total_break_seconds: number;
  notes: string | null;
  created_at: string;
}

export interface ShiftBreak {
  id: string;
  shift_id: string;
  started_at: string;
  ended_at: string | null;
}

export interface Punishment {
  id: string;
  type: PunishmentType;
  target_roblox_id: number | null;
  target_username: string;
  reason: string;
  evidence_url: string | null;
  moderator_id: string | null;
  duration_minutes: number | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

export interface FormQuestion {
  id: string;
  label: string;
  type: "short" | "long" | "select" | "yesno";
  required: boolean;
  options?: string[];
}

export interface ApplicationForm {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  questions: FormQuestion[];
  is_open: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  form_id: string;
  applicant_id: string;
  answers: Record<string, string>;
  status: ApplicationStatus;
  reviewer_id: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Session {
  id: string;
  title: string;
  host_id: string | null;
  status: SessionStatus;
  scheduled_for: string | null;
  started_at: string | null;
  ended_at: string | null;
  peak_players: number;
  notes: string | null;
  created_at: string;
}

export interface Poll {
  id: string;
  session_id: string | null;
  question: string;
  options: string[];
  closes_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CadCall {
  id: string;
  department_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  priority: number;
  status: CadStatus;
  created_by: string | null;
  assigned_to: string[];
  created_at: string;
  updated_at: string;
}

export interface ServerSettings {
  id: 1;
  community_name: string;
  erlc_api_key: string | null;
  roblox_group_id: number | null;
  require_group_membership: boolean;
  default_role: AppRole;
  weekly_quota_minutes: number;
  join_code_visible_to: AppRole;
  updated_at: string;
}

export interface GameEvent {
  id: number;
  kind: "join" | "leave" | "kill" | "command" | "modcall";
  payload: Record<string, Json>;
  occurred_at: string;
  created_at: string;
}

/** Convenience: a message with its author joined in. */
export type MessageWithAuthor = Message & {
  author: Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role"> | null;
  reactions?: MessageReaction[];
};

/** Convenience: roster row with profile + rank joined. */
export type RosterRow = DepartmentMember & {
  profile: Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;
  rank: Pick<DepartmentRank, "id" | "name" | "level"> | null;
};
