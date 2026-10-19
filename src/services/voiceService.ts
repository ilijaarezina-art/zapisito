import { Platform } from 'react-native';

let ExpoSpeechRecognitionModule: any = null;
try {
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule || null;
} catch (e) {
  console.warn('[VoiceService] expo-speech-recognition module not found, fallback to web');
}

let activeSubStart: any = null;
let activeSubResult: any = null;
let activeSubError: any = null;
let activeSubEnd: any = null;
let webRecognitionInstance: any = null;
let isListeningState = false;

export const VoiceService = {
  isAvailable: async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return (
        typeof window !== 'undefined' &&
        !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      );
    }
    if (ExpoSpeechRecognitionModule) {
      try {
        const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
        return !!available;
      } catch (e) {
        return false;
      }
    }
    return false;
  },

  requestPermissions: async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      try {
        if (navigator?.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          return true;
        }
      } catch (e) {
        return false;
      }
      return true;
    }

    if (ExpoSpeechRecognitionModule) {
      try {
        const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        return !!perm?.granted;
      } catch (e) {
        console.warn('[VoiceService] requestPermissions error:', e);
        return false;
      }
    }
    return false;
  },

  startListening: async ({
    lang = 'sr-RS',
    onStart,
    onResult,
    onError,
    onEnd,
  }: {
    lang?: string;
    onStart?: () => void;
    onResult?: (transcript: string, isFinal: boolean) => void;
    onError?: (errMessage: string) => void;
    onEnd?: () => void;
  }): Promise<boolean> => {
    VoiceService.stopListening();

    // 1. WEB BROWSER IMPLEMENTACIJA
    if (Platform.OS === 'web') {
      const SpeechRec =
        typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

      if (!SpeechRec) {
        onError?.('Prepoznavanje govora nije podržano u ovom pregledaču (preporučujemo Google Chrome ili Edge).');
        return false;
      }

      try {
        const rec = new SpeechRec();
        rec.lang = lang;
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 1;

        rec.onstart = () => {
          isListeningState = true;
          onStart?.();
        };

        rec.onresult = (event: any) => {
          let transcript = '';
          let isFinal = false;
          for (let i = 0; i < event.results.length; i++) {
            if (event.results[i] && event.results[i][0]) {
              const chunk = event.results[i][0].transcript || '';
              if (transcript && !transcript.endsWith(' ') && !chunk.startsWith(' ')) {
                transcript += ' ' + chunk;
              } else {
                transcript += chunk;
              }
              if (event.results[i].isFinal) isFinal = true;
            }
          }
          if (transcript.trim()) {
            onResult?.(transcript.trim(), isFinal);
          }
        };

        rec.onerror = (event: any) => {
          isListeningState = false;
          const err = event.error || 'Greška mikrofona';
          if (err !== 'no-speech') {
            onError?.(err === 'not-allowed' ? 'Dozvola za mikrofon je odbijena.' : err);
          }
        };

        rec.onend = () => {
          isListeningState = false;
          onEnd?.();
        };

        webRecognitionInstance = rec;
        rec.start();
        isListeningState = true;
        return true;
      } catch (err: any) {
        isListeningState = false;
        onError?.(err?.message || 'Greška pri pokretanju mikrofona');
        return false;
      }
    }

    // 2. ANDROID / IOS NATIVE IMPLEMENTACIJA (PREKO EXPO-SPEECH-RECOGNITION)
    if (ExpoSpeechRecognitionModule) {
      try {
        const permGranted = await VoiceService.requestPermissions();
        if (!permGranted) {
          onError?.('Pristup mikrofonu nije odobren. Molimo omogućite mikrofon u podešavanjima telefona.');
          return false;
        }

        VoiceService._cleanNativeListeners();

        activeSubStart = ExpoSpeechRecognitionModule.addListener('start', () => {
          isListeningState = true;
          onStart?.();
        });

        activeSubResult = ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
          const results = event?.results || [];
          const best = results[0]?.transcript || '';
          const isFinal = !!event?.isFinal;
          if (best) {
            onResult?.(best.trim(), isFinal);
          }
        });

        activeSubError = ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
          isListeningState = false;
          const code = event?.error || 'error';
          if (code !== 'no-speech' && code !== 'aborted') {
            onError?.(event?.message || code);
          }
        });

        activeSubEnd = ExpoSpeechRecognitionModule.addListener('end', () => {
          isListeningState = false;
          onEnd?.();
        });

        await ExpoSpeechRecognitionModule.start({
          lang,
          interimResults: true,
          continuous: true,
          requiresOnDeviceRecognition: false,
          addsPunctuation: false,
        });

        isListeningState = true;
        return true;
      } catch (nativeErr: any) {
        isListeningState = false;
        onError?.(nativeErr?.message || 'Neuspešno pokretanje prepoznavanja govora');
        return false;
      }
    }

    onError?.('Glasovni unos nije podržan na ovom uređaju.');
    return false;
  },

  stopListening: () => {
    isListeningState = false;

    if (webRecognitionInstance) {
      try {
        webRecognitionInstance.stop();
      } catch (e) {}
      webRecognitionInstance = null;
    }

    if (ExpoSpeechRecognitionModule) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {}
      VoiceService._cleanNativeListeners();
    }
  },

  isListening: () => {
    return isListeningState;
  },

  _cleanNativeListeners: () => {
    if (activeSubStart?.remove) activeSubStart.remove();
    if (activeSubResult?.remove) activeSubResult.remove();
    if (activeSubError?.remove) activeSubError.remove();
    if (activeSubEnd?.remove) activeSubEnd.remove();
    activeSubStart = null;
    activeSubResult = null;
    activeSubError = null;
    activeSubEnd = null;
  },
};
