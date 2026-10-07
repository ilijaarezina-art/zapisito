import { registerRootComponent } from 'expo';
import { Platform, LogBox } from 'react-native';
import App from './App';

// Utišavanje internih react-native-web deprecation upozorenja na Web pregledaču
if (Platform.OS === 'web') {
  LogBox.ignoreLogs([
    'props.pointerEvents is deprecated',
    'shadow* style props are deprecated'
  ]);

  const filterDeprecated = (originalFn) => {
    return (...args) => {
      if (typeof args[0] === 'string') {
        if (
          args[0].includes('pointerEvents is deprecated') ||
          args[0].includes('shadow* style props are deprecated')
        ) {
          return;
        }
      }
      originalFn(...args);
    };
  };

  console.warn = filterDeprecated(console.warn);
  console.error = filterDeprecated(console.error);
}

registerRootComponent(App);
