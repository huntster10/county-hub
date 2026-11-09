/**
 * Shapes returned by the ER:LC Private Server API (https://api.erlc.gg).
 * Field names are exactly as the API returns them (PascalCase).
 */

export interface ErlcServerStatus {
  Name: string;
  OwnerId: number;
  CoOwnerIds: number[];
  CurrentPlayers: number;
  MaxPlayers: number;
  JoinKey: string;
  AccVerifiedReq: string;
  TeamBalance: boolean;
}

export interface ErlcPlayer {
  /** "Username:RobloxId" */
  Player: string;
  Permission: string; // "Normal" | "Server Moderator" | "Server Administrator" | "Server Owner" ...
  Callsign: string | null;
  Team: string; // "Police" | "Sheriff" | "Fire" | "DOT" | "Civilian" | "Jail"
  WantedStars?: number;
  Location?: {
    LocationX: number;
    LocationZ: number;
    PostalCode: string;
    StreetName: string;
    BuildingNumber: string;
  } | null;
}

export interface ErlcJoinLog {
  Join: boolean;
  Timestamp: number; // unix seconds
  Player: string;
}

export interface ErlcKillLog {
  Killed: string;
  Timestamp: number;
  Killer: string;
}

export interface ErlcCommandLog {
  Player: string;
  Timestamp: number;
  Command: string;
}

export interface ErlcModCall {
  Caller: string;
  Moderator: string | null;
  Timestamp: number;
}

export interface ErlcVehicle {
  Name: string;
  Owner: string;
  Plate?: string;
  Texture: string | null;
  ColorHex?: string;
  ColorName?: string;
}

export interface ErlcStaff {
  Admins: Record<string, string>;
  Mods: Record<string, string>;
  Helpers?: Record<string, string>;
}

/** Response of GET /v2/server with every optional section requested. */
export interface ErlcServerSnapshot extends ErlcServerStatus {
  Players?: ErlcPlayer[];
  Staff?: ErlcStaff;
  JoinLogs?: ErlcJoinLog[];
  KillLogs?: ErlcKillLog[];
  CommandLogs?: ErlcCommandLog[];
  ModCalls?: ErlcModCall[];
  Queue?: number[];
  Vehicles?: ErlcVehicle[];
}

/** Bans: map of Roblox user id -> username. */
export type ErlcBans = Record<string, string>;

export interface ErlcRateLimit {
  bucket: string | null;
  limit: number | null;
  remaining: number | null;
  resetAt: number | null; // unix seconds
}

export class ErlcApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
    this.name = "ErlcApiError";
  }
}
