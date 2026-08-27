/**
 * Role definitions for the admin dashboard.
 *
 * IMPORTANT: this file is the UI's copy of the rules. It decides what to *show*.
 * The authoritative copy lives in supabase/functions/admin-dashboard-api/index.ts and is
 * what actually *enforces* them — hiding a button in React stops nobody who opens devtools.
 * If you change a permission here, change it there too.
 */

export type Role = 'owner' | 'viewer';

export type TabKey = 'overview' | 'users' | 'contacts' | 'subscriptions';

export interface Permissions {
  /** Tabs this role may open. */
  tabs: TabKey[];
  /** May ban / reactivate user accounts. */
  canBanUsers: boolean;
  /** May move contact requests between statuses. */
  canManageContacts: boolean;
}

export const PERMISSIONS: Record<Role, Permissions> = {
  owner: {
    tabs: ['overview', 'users', 'contacts', 'subscriptions'],
    canBanUsers: true,
    canManageContacts: true,
  },
  viewer: {
    tabs: ['overview', 'users'],
    canBanUsers: false,
    canManageContacts: false,
  },
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  viewer: 'Viewer',
};

export function permissionsFor(role: Role | null): Permissions {
  return role ? PERMISSIONS[role] : { tabs: [], canBanUsers: false, canManageContacts: false };
}
