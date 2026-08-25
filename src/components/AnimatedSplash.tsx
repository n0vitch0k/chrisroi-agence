import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import * as Font from 'expo-font';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish?: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const reveal = useRef(new Animated.Value(0)).current;
  const subtitle = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const [fontsLoaded, setFontsLoaded] = React.useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Font.loadAsync({
          'GreatVibes': require('../../assets/fonts/GreatVibes-Regular.ttf'),
          'CormorantLight': require('../../assets/fonts/CormorantGaramond-Light.ttf'),
        });
      } catch {}
      if (!cancelled) setFontsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    // Tout en driver natif : on anime scaleX / translateX / opacity uniquement (pas width)
    const tLine = Animated.timing(line, { toValue: 1, duration: 1800, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const tReveal = Animated.timing(reveal, { toValue: 1, duration: 1900, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    const tSub = Animated.timing(subtitle, { toValue: 1, duration: 900, delay: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    tLine.start(); tReveal.start(); tSub.start(); loop.start();
    const timer = setTimeout(() => onFinish?.(), 5200);
    return () => { clearTimeout(timer); loop.stop(); };
  }, [fontsLoaded, onFinish, reveal, subtitle, glow, line]);

  if (!fontsLoaded) {
    return <View style={s.fallback} />;
  }

  const lineScale = line.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.07, 0.15], extrapolate: 'clamp' });
  const cOpacity = line.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.09, 0.09], extrapolate: 'clamp' });
  // Reveal ChrisRoi : on translate le texte depuis la gauche avec clip
  const revealTx = reveal.interpolate({ inputRange: [0, 1], outputRange: [-140, 0], extrapolate: 'clamp' });
  const revealOp = reveal.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const subOp = subtitle.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const subTy = subtitle.interpolate({ inputRange: [0, 1], outputRange: [10, 0], extrapolate: 'clamp' });

  return (
    <View style={s.root}>
      <View style={s.bg} />
      {/* C doré très léger en fond */}
      <Animated.Text style={[s.bgC, { opacity: Animated.add(cOpacity, glowOpacity) as any }]}>C</Animated.Text>

      <View style={s.center}>
        {/* Ligne dorée — animée en scaleX (natif), pas en width */}
        <View style={s.lineTrack}>
          <Animated.View style={[s.lineFill, { transform: [{ scaleX: lineScale }] }]} />
        </View>

        {/* ChrisRoi — reveal par translate + opacity (tout natif), clip par overflow */}
        <View style={s.titleClipOuter}>
          <Animated.View style={{ opacity: revealOp, transform: [{ translateX: revealTx }] }}>
            <Text style={s.title}>ChrisRoi</Text>
          </Animated.View>
        </View>

        {/* AGENCE */}
        <Animated.View style={{ opacity: subOp, transform: [{ translateY: subTy }] }}>
          <Text style={s.subtitle}>AGENCE</Text>
          <View style={s.divider} />
          <Text style={s.tagline}>Agence de placement de personnel</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#0d0a09' },
  root: { flex: 1, backgroundColor: '#0d0a09', alignItems: 'center', justifyContent: 'center' },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0d0a09' },
  bgC: {
    position: 'absolute',
    fontFamily: 'GreatVibes',
    fontSize: 320,
    color: '#d4a853',
    top: height * 0.5 - 210,
    left: width * 0.5 - 86,
    // @ts-ignore
    userSelect: 'none',
  } as any,
  center: { alignItems: 'center', justifyContent: 'center', width: Math.min(360, width - 32) },
  lineTrack: { height: 1.5, width: 200, backgroundColor: 'rgba(212,168,83,0.18)', borderRadius: 1, overflow: 'hidden', marginBottom: 18 },
  lineFill: { height: '100%', width: '100%', backgroundColor: '#d4a853', borderRadius: 1 },
  titleClipOuter: { height: 74, justifyContent: 'center', overflow: 'hidden', alignItems: 'center' },
  title: {
    fontFamily: 'GreatVibes',
    fontSize: 58,
    color: '#f5e6c8',
    textAlign: 'center',
    textShadowColor: 'rgba(212,168,83,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subtitle: {
    fontFamily: 'CormorantLight',
    fontSize: 14,
    letterSpacing: 10,
    color: '#d4a853',
    textAlign: 'center',
    marginTop: 6,
  },
  divider: { height: 1, width: 44, backgroundColor: 'rgba(212,168,83,0.45)', alignSelf: 'center', marginTop: 10, marginBottom: 10, borderRadius: 1 },
  tagline: { fontSize: 11, letterSpacing: 1.6, color: 'rgba(255,255,255,0.62)', textAlign: 'center' },
});
