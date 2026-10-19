import React, { useRef, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';
import { MediaImage } from './MediaImage';

/**
 * The pictures of a post, full width and square like Instagram: swipe sideways for more,
 * dots and a "1/3" counter show where you are, and a double tap calls onDoubleTap (like).
 */
export function PostImages({ ids, onDoubleTap }: { ids: string[]; onDoubleTap?: () => void }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);

  if (ids.length === 0) return null;

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) { lastTap.current = 0; onDoubleTap?.(); }
    else lastTap.current = now;
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <View style={{ width, height: width }}>
      <FlatList
        data={ids}
        keyExtractor={(id, i) => `${id}-${i}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <TouchableWithoutFeedback onPress={onTap}>
            <View>
              <MediaImage id={item} width={width} height={width} style={styles.bleed} />
            </View>
          </TouchableWithoutFeedback>
        )}
      />
      {ids.length > 1 && (
        <>
          <View style={styles.counter}><Text style={styles.counterText}>{index + 1}/{ids.length}</Text></View>
          <View style={styles.dots}>
            {ids.map((_, i) => <View key={i} style={[styles.dot, i === index && styles.dotOn]} />)}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bleed:       { borderRadius: 0, borderWidth: 0 },
  counter:     { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  dots:        { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn:       { backgroundColor: '#fff' },
});
