import React from 'react';
import QueryList from '../shared/QueryList';
import { type VisitorRow } from '../shared/opsModel';
import { fetchVisitorRows, VisitorCard } from './LogScreen';

/** Deliveries only: couriers and parcels that came to the gate. */
export default function DeliveryScreen() {
  return (
    <QueryList<VisitorRow>
      title="Deliveries"
      queryKey={['guard', 'deliveries']}
      fetcher={async () => (await fetchVisitorRows()).filter((v) => v.purpose === 'Delivery')}
      keyOf={(v) => v.id}
      renderItem={(v) => <VisitorCard v={v} />}
      emptyText="No deliveries yet."
    />
  );
}
