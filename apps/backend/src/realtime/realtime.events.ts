/**
 * Internal event-bus names that make the realtime gateway cut live sockets.
 * Emit them through EventEmitter2 (global); the gateway reacts with @OnEvent,
 * so the emitting module never imports the gateway.
 */

/**
 * An organization lost access (suspended, archived or deleted): every socket in
 * it is disconnected. Emitted by PlatformService.
 */
export const ORGANIZATION_SUSPENDED = 'organization.suspended';
export interface OrganizationSuspendedEvent {
  organizationId: string;
}

/**
 * A user lost access and all their sockets must go: the account was
 * deactivated (issue #134 only has to emit this: `events.emit(USER_DEACTIVATED,
 * { userId } satisfies UserDeactivatedEvent)` after the change is persisted) or
 * hard-deleted. A user that is still deactivated cannot reconnect once the
 * gateway's connect-time check (`RealtimeGateway.authorize`) also tests the new flag.
 */
export const USER_DEACTIVATED = 'user.deactivated';
export interface UserDeactivatedEvent {
  userId: string;
}
