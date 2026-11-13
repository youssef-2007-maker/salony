// On web, react-native-web's Alert.alert is a no-op, so every confirm dialog
// (sign out, delete account, decline booking, etc.) would silently do nothing.
// This maps Alert.alert onto the browser's alert/confirm so the same code works
// on iOS, Android and web.
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = Array.isArray(buttons) ? buttons : [];

    if (list.length <= 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }

    // Two or more buttons: OK runs the first non-cancel action, Cancel runs the
    // cancel button (if any).
    const cancel = list.find((b) => b.style === 'cancel');
    const actions = list.filter((b) => b !== cancel);

    if (actions.length === 1) {
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel?.onPress?.();
      return;
    }

    // Several actions (e.g. "Camera" / "Library"): ask one confirm per option.
    for (const action of actions) {
      if (window.confirm(`${text}\n\n${action.text}?`)) {
        action.onPress?.();
        return;
      }
    }
    cancel?.onPress?.();
  };
}
