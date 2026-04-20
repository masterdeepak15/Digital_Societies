import React from 'react';
import { useAuthStore } from '../store/authStore';

// Role-specific tab navigators
import AdminTabs    from './AdminTabs';
import ResidentTabs from './ResidentTabs';
import GuardTabs    from './GuardTabs';
import StaffTabs    from './StaffTabs';

/**
 * Renders the correct tab navigator based on the user's active role.
 * Role switching happens by calling setActiveSociety in the store,
 * which re-renders this component with the new role. (OCP — add new
 * role screens without touching this router logic)
 */
export default function RoleRouter() {
  const role = useAuthStore((s) => s.activeRole);

  switch (role) {
    case 'admin':
    case 'accountant': return <AdminTabs />;
    case 'guard':      return <GuardTabs />;
    case 'staff':      return <StaffTabs />;
    default:           return <ResidentTabs />;  // resident / family / tenant
  }
}
