import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatHub } from '../services/chat/useChatHub';
import { useQuery } from '@tanstack/react-query';
import { fetchOffice } from '../services/settings/societyRules';
import { OfflineQueueService } from '../services/offline/OfflineQueueService';

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
  useChatHub();          // one live connection for every role view: chat, visitor and emergency alerts

  // The society's own rules for this phone: how long visitor details are kept (the guard's phone wipes older ones).
  const office = useQuery({ queryKey: ['society-office'], queryFn: fetchOffice, staleTime: 10 * 60_000 });
  React.useEffect(() => { if (office.data) OfflineQueueService.configure({ wipeAfterDays: office.data.piiWipeDays }); }, [office.data]);

  switch (role) {
    case 'admin':
    case 'accountant': return <AdminTabs />;
    case 'guard':      return <GuardTabs />;
    case 'staff':      return <StaffTabs />;
    default:           return <ResidentTabs />;  // resident / family / tenant
  }
}
