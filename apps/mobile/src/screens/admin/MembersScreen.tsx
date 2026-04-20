import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';
import { Spacing } from '../../theme/spacing';

export default function MembersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MembersScreen</Text>
      <Text style={styles.sub}>[admin] — Implementation in Phase 1 build</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md, justifyContent: 'center', alignItems: 'center' },
  title:     { ...Typography.h2, color: Colors.primary, textAlign: 'center' },
  sub:       { ...Typography.body2, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
});
