import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Icon } from './Icon';
import { TextField } from './TextField';
import { ThemeModeSelector } from './ThemeModeSelector';
import { useTheme } from '../theme/ThemeProvider';
import { getServerOrigin, normalizeServerUrl, testConnection } from '../config/serverConfig';
import { applyServerChange } from '../config/applyServerChange';
import { describeConnection, describeValidation } from '../config/messages';

const EXAMPLES = ['https://society.example.com', 'https://192.168.1.20:8443'];

type Check = { state: 'idle' } | { state: 'testing' } | { state: 'ok' } | { state: 'error'; message: string };

/**
 * Server address + appearance, reachable before sign-in.
 * Save never requires a successful test (the phone may simply be offline right now).
 */
export function ServerSheet({ visible, onClose, onSaved }: {
  visible: boolean; onClose: () => void; onSaved: (origin: string) => void;
}) {
  const { colors, fonts, radius } = useTheme();
  const [value, setValue] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCheck({ state: 'idle' });
    getServerOrigin().then((o) => setValue(o ?? ''));
  }, [visible]);

  const normalized = normalizeServerUrl(value);
  const typed = value.trim().length > 0;
  const validationError = typed && !normalized.ok ? describeValidation(normalized.reason) : undefined;

  const runTest = async () => {
    if (!normalized.ok) return;
    setCheck({ state: 'testing' });
    const result = await testConnection(normalized.origin);
    setCheck(result.ok ? { state: 'ok' } : { state: 'error', message: describeConnection(result) });
  };

  const save = async () => {
    if (!normalized.ok) return;
    setSaving(true);
    try {
      await applyServerChange(normalized.origin);
      onSaved(normalized.origin);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Server address">
      <Text style={{ color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 }}>
        Type the web address your society uses. It can be a domain, or an IP address with a port.
      </Text>

      <TextField
        label="Address"
        value={value}
        onChangeText={(t) => { setValue(t); setCheck({ state: 'idle' }); }}
        error={validationError}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://society.example.com"
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {EXAMPLES.map((e) => (
          <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Use ${e}`} onPress={() => setValue(e)}
            style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
            <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12 }}>{e}</Text>
          </Pressable>
        ))}
      </View>

      {check.state === 'ok' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLiveRegion="polite">
          <Icon name="check-circle" size={18} color={colors.success} />
          <Text style={{ color: colors.success, fontFamily: fonts.semibold, fontSize: 14 }}>Connected. The server is reachable.</Text>
        </View>
      ) : check.state === 'error' ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }} accessibilityLiveRegion="polite">
          <Icon name="alert-circle" size={18} color={colors.danger} />
          <Text style={{ flex: 1, color: colors.danger, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 }}>{check.message}</Text>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>Appearance</Text>
        <ThemeModeSelector />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button title="Test connection" variant="secondary" onPress={runTest} disabled={!normalized.ok} loading={check.state === 'testing'} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Save" onPress={save} disabled={!normalized.ok} loading={saving} />
        </View>
      </View>
    </BottomSheet>
  );
}
