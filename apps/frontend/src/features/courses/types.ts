/**
 * Roster types for A3 — course enrollment management.
 */

/** Minimal user display data from GET /users/by-ids (batch endpoint). */
export interface RosterUserDTO {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  /** #134: the account is deactivated (enrolment kept). */
  deactivated: boolean;
}

/** Frontend row model after merging enrollment + user data. */
export interface RosterRow {
  enrollmentId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'TEACHER' | 'ASSISTANT' | 'STUDENT';
  progress: number; // 0-100, from enrollment.progress
}
