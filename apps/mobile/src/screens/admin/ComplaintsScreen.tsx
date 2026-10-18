import React from 'react';
import ComplaintList from '../shared/ComplaintList';

/** Every complaint in the society, newest first, with the next-step button. */
export default function ComplaintsScreen() {
  return <ComplaintList title="Complaints" path="/complaints?page=1&pageSize=50" queryKey={['admin', 'complaints']} />;
}
