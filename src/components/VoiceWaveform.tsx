import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface VoiceWaveformProps {
  aktivan: boolean;
  boja?: string;
}

export default function VoiceWaveform({ aktivan, boja = '#10B981' }: VoiceWaveformProps) {
  const anim1 = useRef(new Animated.Value(10)).current;
  const anim2 = useRef(new Animated.Value(18)).current;
  const anim3 = useRef(new Animated.Value(28)).current;
  const anim4 = useRef(new Animated.Value(14)).current;
  const anim5 = useRef(new Animated.Value(22)).current;
  const anim6 = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!aktivan) {
      anim1.setValue(8);
      anim2.setValue(12);
      anim3.setValue(16);
      anim4.setValue(12);
      anim5.setValue(14);
      anim6.setValue(8);
      return;
    }

    const napraviAnimaciju = (anim: Animated.Value, minH: number, maxH: number, trajanje: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: maxH,
            duration: trajanje,
            useNativeDriver: false
          }),
          Animated.timing(anim, {
            toValue: minH,
            duration: trajanje,
            useNativeDriver: false
          })
        ])
      );
    };

    const loop1 = napraviAnimaciju(anim1, 8, 26, 320);
    const loop2 = napraviAnimaciju(anim2, 10, 36, 260);
    const loop3 = napraviAnimaciju(anim3, 14, 42, 380);
    const loop4 = napraviAnimaciju(anim4, 8, 30, 290);
    const loop5 = napraviAnimaciju(anim5, 12, 38, 350);
    const loop6 = napraviAnimaciju(anim6, 6, 24, 270);

    loop1.start();
    loop2.start();
    loop3.start();
    loop4.start();
    loop5.start();
    loop6.start();

    return () => {
      loop1.stop();
      loop2.stop();
      loop3.stop();
      loop4.stop();
      loop5.stop();
      loop6.stop();
    };
  }, [aktivan]);

  return (
    <View style={styles.kontejner}>
      <Animated.View style={[styles.bar, { height: anim1, backgroundColor: boja }]} />
      <Animated.View style={[styles.bar, { height: anim2, backgroundColor: boja }]} />
      <Animated.View style={[styles.bar, { height: anim3, backgroundColor: boja }]} />
      <Animated.View style={[styles.bar, { height: anim4, backgroundColor: boja }]} />
      <Animated.View style={[styles.bar, { height: anim5, backgroundColor: boja }]} />
      <Animated.View style={[styles.bar, { height: anim6, backgroundColor: boja }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  kontejner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 8
  },
  bar: {
    width: 4,
    borderRadius: 3
  }
});
