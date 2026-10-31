import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

/** 웹뷰 대신 보이는 화면 (로딩·연결 실패). 웹과 같은 브랜드색·글자색, 여백은 4의 배수 */
const BRAND = '#20967A';
const TEXT = '#151517';

export function LoadingScreen() {
  return (
    <View style={styles.screen}>
      <ActivityIndicator size="large" color={BRAND} />
    </View>
  );
}

/** 오프라인·서버 오류. 다시 시도는 웹뷰를 새로고침한다 */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.message}>연결할 수 없어요.{'\n'}인터넷 연결을 확인하고 다시 시도해 주세요</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  message: { fontSize: 16, lineHeight: 24, color: TEXT, textAlign: 'center' },
  button: {
    marginTop: 24,
    height: 56,
    alignSelf: 'stretch',
    borderRadius: 16,
    backgroundColor: BRAND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
