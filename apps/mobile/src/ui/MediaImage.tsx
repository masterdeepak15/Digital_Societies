import React from 'react';
import { ActivityIndicator, Image, StyleProp, View, ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchMediaFile } from '../services/media/mediaService';
import { useTheme } from '../theme/ThemeProvider';

/** A stored picture by id (or a local file while it is still waiting to upload). */
export function MediaImage({ id, uri, size = 72, width, height, style }: { id?: string | null; uri?: string | null; size?: number; width?: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const w = width ?? size, h = height ?? size;
  const { colors, radius } = useTheme();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['media', id],
    queryFn: () => fetchMediaFile(id as string),
    enabled: !!id && !uri,
    staleTime: Infinity,
    retry: 1,
  });
  const source = uri ?? data;
  return (
    <View style={[{ width: w, height: h, borderRadius: radius.control, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {source ? <Image source={{ uri: source }} style={{ width: w, height: h }} resizeMode="cover" />
        : isLoading ? <ActivityIndicator color={colors.muted} />
        : isError ? null : null}
    </View>
  );
}
