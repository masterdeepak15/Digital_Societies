import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';
import { errorMessage } from '../../utils/errorMessage';

interface Props<T> {
  title: string;
  queryKey: unknown[];
  fetcher: () => Promise<T[]>;
  renderItem: (item: T) => React.ReactElement;
  keyOf: (item: T) => string;
  emptyText: string;
  header?: React.ReactElement | null;
}

/** A titled, pull-to-refresh list with loading, error and empty states, used by the simple list screens. */
export default function QueryList<T>({ title, queryKey, fetcher, renderItem, keyOf, emptyText, header }: Props<T>) {
  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({ queryKey, queryFn: fetcher });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {header}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={Colors.primary} />
      ) : isError ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{errorMessage(error, 'Could not load this list.')}</Text>
          <TouchableOpacity onPress={() => refetch()}><Text style={styles.retry}>Try again</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={keyOf}
          renderItem={({ item }) => renderItem(item)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>{emptyText}</Text></View>}
        />
      )}
    </View>
  );
}

export const listStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  primary: { ...Typography.h4, color: Colors.textPrimary, flexShrink: 1 },
  secondary: { ...Typography.body2, color: Colors.textSecondary },
  pill: { ...Typography.caption, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  btn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: 10, alignItems: 'center', backgroundColor: Colors.primary },
  btnAlt: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  btnText: { ...Typography.body2, fontWeight: '700', color: Colors.textOnPrimary },
  btnAltText: { color: Colors.textPrimary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { ...Typography.h2, color: Colors.primary, padding: Spacing.md, paddingTop: Spacing.xl },
  list: { padding: Spacing.md, gap: Spacing.sm },
  empty: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center' },
  retry: { ...Typography.body2, color: Colors.primary, fontWeight: '700' },
});
