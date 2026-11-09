import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

/** 웹 첫 화면을 기다리는 최대 시간. 넘으면 걷어 내고 웹뷰의 로딩·오류 화면에 맡긴다 */
const MAX_WAIT_MS = 15_000;
const FADE_MS = 250;

/**
 * 스플래시 (2026-11-10 대표 확정). iOS 시작 화면(ios/Minicovery/LaunchScreen.storyboard)과 같은 배치라
 * 앱이 켜지는 순간부터 웹 첫 화면이 뜰 때까지 한 장면으로 이어진다: 검은 바탕, 두들 말풍선 + 로고 + 슬로건, 위·아래 빈 공간 4:6.
 * visible이 false가 되면 잠깐 흐려지며 사라진다.
 */
export function Splash({ visible, onTimeout }: { visible: boolean; onTimeout: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onTimeout, MAX_WAIT_MS);
    return () => clearTimeout(id);
  }, [visible, onTimeout]);

  useEffect(() => {
    if (visible) return;
    Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => setGone(true));
  }, [visible, opacity]);

  if (gone) return null;
  return (
    <Animated.View style={[styles.screen, { opacity }]} pointerEvents={visible ? 'auto' : 'none'} accessibilityLabel="미니커버리">
      <View style={styles.top} />
      <Image source={require('../assets/splash/bubbles.png')} style={styles.bubbles} />
      <Image source={require('../assets/splash/wordmark.png')} style={styles.wordmark} accessibilityLabel="MINICOVERY" />
      <Text style={styles.slogan} allowFontScaling={false}>
        출근길 한 편이면 대화가 달라져요
      </Text>
      <View style={styles.bottom} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000000', alignItems: 'center' },
  top: { flex: 4 },
  bottom: { flex: 6 },
  bubbles: { width: 110, height: 80 },
  wordmark: { width: 280, height: 34, marginTop: 28 },
  slogan: { marginTop: 20, fontSize: 17, fontWeight: '300', color: '#FFFFFF' },
});
