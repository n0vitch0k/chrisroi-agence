import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import * as Font from 'expo-font';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish?: () => void;
  statusText?: string;
}

export default function AnimatedSplash({ onFinish, statusText }: AnimatedSplashProps) {
  const line = useRef(new Animated.Value(0)).current;
  const title = useRef(new Animated.Value(0)).current;
  const subtitle = useRef(new Animated.Value(0)).current;
  const bgPhase = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const [fontsLoaded, setFontsLoaded] = React.useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Font.loadAsync({
          GreatVibes: require('../../assets/fonts/GreatVibes-Regular.ttf'),
          CormorantLight: require('../../assets/fonts/CormorantGaramond-Light.ttf'),
        });
      } catch {}
      if (!cancelled) setFontsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    const elastic = Easing.bezier(0.34, 1.56, 0.64, 1);

    // Ligne élastique B2 : scaleX 0 -> 1.08 -> 0.98 -> 1
    const tLine = Animated.timing(line, {
      toValue: 1,
      duration: 1100,
      delay: 200,
      easing: elastic,
      useNativeDriver: true,
    });

    // Titre ChrisRoi B2 : translateY 28 -> -8 -> 3 -> 0 + scale
    const tTitle = Animated.timing(title, {
      toValue: 1,
      duration: 1050,
      delay: 600,
      easing: elastic,
      useNativeDriver: true,
    });

    // Sous-titre / divider / tagline fadeUp
    const tSub = Animated.timing(subtitle, {
      toValue: 1,
      duration: 700,
      delay: 1600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    // Fond Nuit -> Jour : 0 -> 1 sur 960ms après 1200ms de sombre (total 3200ms)
    const tBg = Animated.timing(bgPhase, {
      toValue: 1,
      duration: 960,
      delay: 1216,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false, // couleur nécessite JS thread
    });

    // Dots loading séquentiel en boucle : chaque point rebondit à tour de rôle
    // dotLoadPlay : 0% idle, 18% -12px, 32% +2px, 48% 0
    const makeDotLoop = (anim: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(anim, {
            toValue: 1,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 220,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(900 - 160 - 220),
        ])
      );

    const loop1 = makeDotLoop(dot1, 0);
    const loop2 = makeDotLoop(dot2, 150);
    const loop3 = makeDotLoop(dot3, 300);

    // Démarrage : dots avec délai global 1900ms pour laisser le titre entrer
    const dotStart = setTimeout(() => {
      loop1.start();
      loop2.start();
      loop3.start();
    }, 1900);

    tLine.start();
    tTitle.start();
    tSub.start();
    tBg.start();

    const timer = setTimeout(() => onFinish?.(), 3800);
    return () => {
      clearTimeout(timer);
      clearTimeout(dotStart);
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [fontsLoaded, onFinish, line, title, subtitle, bgPhase, dot1, dot2, dot3]);

  if (!fontsLoaded) {
    return <View style={s.fallback} />;
  }

  // Interpolations
  const lineScale = line.interpolate({ inputRange: [0, 0.62, 0.82, 1], outputRange: [0, 1.08, 0.98, 1], extrapolate: 'clamp' });
  const titleTy = title.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [28, -8, 3, 0], extrapolate: 'clamp' });
  const titleScale = title.interpolate({ inputRange: [0, 0.55, 0.75, 1], outputRange: [0.96, 1.04, 0.99, 1], extrapolate: 'clamp' });
  const titleOp = title.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const subOp = subtitle.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const subTy = subtitle.interpolate({ inputRange: [0, 1], outputRange: [10, 0], extrapolate: 'clamp' });

  // Couleurs interpolées Nuit -> Jour (JS thread)
  const bgColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#0d0a09', '#fdf8f3'], extrapolate: 'clamp' }) as any;
  const titleColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#f5e6c8', '#c45a2a'], extrapolate: 'clamp' }) as any;
  const subtitleColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#d4a853', '#8a7d72'], extrapolate: 'clamp' }) as any;
  const taglineColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.88)', '#6b5f55'], extrapolate: 'clamp' }) as any;
  const statusColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.88)', '#6b5f55'], extrapolate: 'clamp' }) as any;
  const lineBg = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#d4a853', '#c45a2a'], extrapolate: 'clamp' }) as any;
  const dividerBg = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['rgba(212,168,83,0.45)', 'rgba(196,90,42,0.28)'], extrapolate: 'clamp' }) as any;
  const bgCColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#d4a853', '#c45a2a'], extrapolate: 'clamp' }) as any;
  const bgCOpacity = bgPhase.interpolate({ inputRange: [0, 1], outputRange: [0.09, 0.06], extrapolate: 'clamp' });

  // Dots : translateY -12px au pic
  const dotTy1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotScale1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18], extrapolate: 'clamp' });
  const dotTy2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotScale2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18], extrapolate: 'clamp' });
  const dotTy3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotScale3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18], extrapolate: 'clamp' });

  return (
    <View style={s.root}>
      <Animated.View style={[s.bg, { backgroundColor: bgColor }]} />
      <Animated.Text style={[s.bgC, { color: bgCColor, opacity: bgCOpacity }]}>C</Animated.Text>

      <View style={s.center}>
        <View style={s.lineTrack}>
          <Animated.View style={[s.lineFill, { backgroundColor: lineBg, transform: [{ scaleX: lineScale }] }]} />
        </View>

        <View style={s.titleClipOuter}>
          <Animated.View style={{ opacity: titleOp, transform: [{ translateY: titleTy }, { scale: titleScale }] }}>
            <Animated.Text style={[s.title, { color: titleColor }]}>ChrisRoi</Animated.Text>
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: subOp, transform: [{ translateY: subTy }] }}>
          <Animated.Text style={[s.subtitle, { color: subtitleColor }]}>AGENCE</Animated.Text>
          <Animated.View style={[s.divider, { backgroundColor: dividerBg }]} />
          <Animated.Text style={[s.tagline, { color: taglineColor }]}>Agence de placement de personnel</Animated.Text>
        </Animated.View>
      </View>

      {/* Statut connexion juste au-dessus des points */}
      {statusText ? (
        <View style={s.statusWrap}>
          <Animated.Text style={[s.statusText, { color: statusColor }]}>{statusText}</Animated.Text>
        </View>
      ) : null}

      {/* Dots en bas d'écran, loading séquentiel */}
      <View style={s.dotsRow}>
        <Animated.View style={[s.dot, s.dotT, { transform: [{ translateY: dotTy1 }, { scale: dotScale1 }] }]} />
        <Animated.View style={[s.dot, s.dotO, { transform: [{ translateY: dotTy2 }, { scale: dotScale2 }] }]} />
        <Animated.View style={[s.dot, s.dotG, { transform: [{ translateY: dotTy3 }, { scale: dotScale3 }] }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#0d0a09' },
  root: { flex: 1, backgroundColor: '#0d0a09', alignItems: 'center', justifyContent: 'center' },
  bg: { ...StyleSheet.absoluteFillObject },
  bgC: {
    position: 'absolute',
    fontFamily: 'GreatVibes',
    fontSize: 320,
    top: height * 0.5 - 210,
    left: width * 0.5 - 86,
    // @ts-ignore
    userSelect: 'none',
  } as any,
  center: { alignItems: 'center', justifyContent: 'center', width: Math.min(360, width - 32) },
  lineTrack: { height: 1.5, width: 200, backgroundColor: 'rgba(212,168,83,0.18)', borderRadius: 1, overflow: 'hidden', marginBottom: 18 },
  lineFill: { height: '100%', width: '100%', borderRadius: 1 },
  titleClipOuter: { height: 74, justifyContent: 'center', overflow: 'hidden', alignItems: 'center' },
  title: {
    fontFamily: 'GreatVibes',
    fontSize: 58,
    textAlign: 'center',
    textShadowColor: 'rgba(212,168,83,0.45)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subtitle: {
    fontFamily: 'CormorantLight',
    fontSize: 14,
    letterSpacing: 10,
    textAlign: 'center',
    marginTop: 6,
  },
  divider: { height: 1, width: 44, alignSelf: 'center', marginTop: 10, marginBottom: 10, borderRadius: 1 },
  tagline: { fontSize: 11, letterSpacing: 1.6, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  dotsRow: {
    position: 'absolute',
    bottom: 56,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  statusWrap: {
    position: 'absolute',
    bottom: 82,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    letterSpacing: 0.6,
    color: '#8a7d72',
    textAlign: 'center',
    opacity: 0.95,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotT: { backgroundColor: '#c45a2a' },
  dotO: { backgroundColor: '#5a7c3a' },
  dotG: { backgroundColor: '#b8860b' },
});
