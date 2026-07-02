import { Alert, Platform } from 'react-native'

// Cross-platform alert. React Native's Alert is a no-op on web, so on web we
// use window.alert and invoke the callback directly (since there's no button).
export function notify(title: string, message?: string, onOk?: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title)
    onOk?.()
  } else {
    Alert.alert(title, message, onOk ? [{ text: 'OK', onPress: onOk }] : undefined)
  }
}
