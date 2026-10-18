import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** Modal bottom sheet with a scrim; tapping the scrim or pressing back closes it. */
export function BottomSheet({ visible, onClose, title, children }: {
  visible: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const { colors, fonts } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel="Close"
          accessibilityRole="button"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,14,26,0.6)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
            borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 14,
          }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
          <Text accessibilityRole="header" style={{ color: colors.text, fontFamily: fonts.extrabold, fontSize: 22 }}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
