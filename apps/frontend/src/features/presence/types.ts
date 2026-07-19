/** A friend of the acting user with their current online status (A6b). */
export interface PresenceFriendDTO {
  id: string;
  name: string;
  avatarUrl: string | null;
  online: boolean;
}

/** Payload of the realtime `presence:update` event. */
export interface PresenceUpdate {
  userId: string;
  online: boolean;
}
