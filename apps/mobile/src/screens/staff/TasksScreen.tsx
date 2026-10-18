import React from 'react';
import ComplaintList from '../shared/ComplaintList';

/** Complaints assigned to this staff member, with a button for the next step. */
export default function TasksScreen() {
  return <ComplaintList title="My tasks" path="/complaints/assigned" queryKey={['staff', 'tasks']} />;
}
