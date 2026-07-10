/**
 * Notification API DTOs
 *
 * Exact shapes of `GET /notifications` (and the realtime `notification:new`
 * socket event, which carries a single {@link NotificationDTO}). See
 * apps/backend/src/notifications.
 */

/** Mirrors the Prisma `NotificationType` enum. */
export type NotificationType =
  | 'NEW_ASSIGNMENT'
  | 'GRADE_PUBLISHED'
  | 'FORUM_REPLY'
  | 'ENROLLMENT'
  | 'DEADLINE_REMINDER'
  | 'FRIEND_REQUEST'
  | 'SYSTEM';

/** A single notification row as returned by the API / pushed over the socket. */
export interface NotificationDTO {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  /** Deep-link into the app, e.g. `/assignments?assignmentId=…` or `/forums/…`. */
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** Paginated envelope returned by `GET /notifications`. */
export interface NotificationsListDTO {
  items: NotificationDTO[];
  page: number;
  pageSize: number;
  total: number;
  /** Count of the user's unread notifications (drives the navbar badge). */
  unread: number;
}
