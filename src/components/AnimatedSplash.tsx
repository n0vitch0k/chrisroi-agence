import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ReAnimated, {
  ZoomIn,
  Keyframe,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  Easing as ReEasing,
} from 'react-native-reanimated';
import {
  SPLASH_TL,
  SPLASH_BR,
  SPLASH_MONO,
  SPLASH_DIAMANT,
  SPLASH_WORD,
} from './splashLogoPaths';
import type { SplashLogoPath } from './splashLogoPaths';

// Splash fidele v3 (maquette mockups/splash_logo_anim_v3.html) :
// couches vectorielles d'icon.svg, coins ancres aux coins, bloc central centre.
// Sequence ~1,9 s : coins -> monogramme -> wordmark -> losange (pop + pulse doux).

interface AnimatedSplashProps {
  onFinish?: () => void;
  statusText?: string;
}

function LayerSvg({ paths, viewBox }: { paths: SplashLogoPath[]; viewBox: string }) {
  return (
    <Svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
      {paths.map((p, i) => (
        <Path key={i} d={p.d} fill={p.fill} stroke={p.stroke} strokeWidth={p.strokeWidth} />
      ))}
    </Svg>
  );
}

const RView = ReAnimated.View;

export default function AnimatedSplash({ onFinish, statusText }: AnimatedSplashProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const u = Math.min(width, height);
  // Zone basse (points + statut) au-dessus de la barre de navigation Android.
  // Jamais plus bas que la position d'origine (56).
  const bottomLift = Math.max(insets.bottom + 16, 56);

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Pulsation douce du losange (tenue splash, boucle infinie legere)
  const diamPulse = useSharedValue(1);
  const diamStyle = useAnimatedStyle(() => ({
    transform: [{ scale: diamPulse.value }],
  }));

  useEffect(() => {
    diamPulse.value = withDelay(
      1800,
      withRepeat(withTiming(1.12, { duration: 900, easing: ReEasing.inOut(ReEasing.quad) }), -1, true),
    );
  }, [diamPulse]);

  useEffect(() => {
    const makeDotLoop = (anim: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(anim, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(900 - 160 - 220),
        ]),
      );
    const loop1 = makeDotLoop(dot1, 0);
    const loop2 = makeDotLoop(dot2, 150);
    const loop3 = makeDotLoop(dot3, 300);
    const dotStart = setTimeout(() => {
      loop1.start();
      loop2.start();
      loop3.start();
    }, 1900);

    const timer = setTimeout(() => onFinish?.(), 3800);
    return () => {
      clearTimeout(timer);
      clearTimeout(dotStart);
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [onFinish, dot1, dot2, dot3]);

  const shift = u * 0.02;
  const tlEnter = new Keyframe({
    0: { opacity: 0, transform: [{ translateX: -shift }, { translateY: -shift }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
  })
    .duration(900)
    .delay(100);
  const brEnter = new Keyframe({
    0: { opacity: 0, transform: [{ translateX: shift }, { translateY: shift }] },
    100: { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }] },
  })
    .duration(900)
    .delay(250);
  const monoEnter = new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.96 }] },
    100: { opacity: 1, transform: [{ scale: 1 }] },
  })
    .duration(1000)
    .delay(550);
  const wordEnter = new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 12 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(800)
    .delay(1050);
  const diamEnter = new ZoomIn().duration(450).delay(1250);

  const dotTy1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotTy2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotTy3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });

  return (
    <View style={s.root}>
      <RView entering={tlEnter} style={[s.coinTl, { width: (u * 342) / 1024 }]}>
        <LayerSvg paths={SPLASH_TL} viewBox="0 0 342 280" />
      </RView>

      <RView entering={brEnter} style={[s.coinBr, { width: (u * 409) / 1024, bottom: insets.bottom }]}>
        <LayerSvg paths={SPLASH_BR} viewBox="618 810 409 217" />
      </RView>

      <View style={[s.centre, { width: (u * 676) / 1024 }]}>
        <RView entering={monoEnter} style={s.fill}>
          <LayerSvg paths={SPLASH_MONO} viewBox="166 248 676 515" />
        </RView>
        <RView entering={wordEnter} style={s.fill}>
          <LayerSvg paths={SPLASH_WORD} viewBox="166 248 676 515" />
        </RView>
        <RView entering={diamEnter} style={s.diamant}>
          <RView style={[s.diamantInner, diamStyle]}>
            <LayerSvg paths={SPLASH_DIAMANT} viewBox="488 568 48 55" />
          </RView>
        </RView>
      </View>

      {statusText ? (
        <View style={[s.statusWrap, { bottom: bottomLift + 26 }]}>
          <Animated.Text style={s.statusText}>{statusText}</Animated.Text>
        </View>
      ) : null}

      <View style={[s.dotsRow, { bottom: bottomLift }]}>
        <Animated.View style={[s.dot, s.dotT, { transform: [{ translateY: dotTy1 }] }]} />
        <Animated.View style={[s.dot, s.dotO, { transform: [{ translateY: dotTy2 }] }]} />
        <Animated.View style={[s.dot, s.dotG, { transform: [{ translateY: dotTy3 }] }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#faf1e8', alignItems: 'center', justifyContent: 'center' },
  coinTl: { position: 'absolute', top: 0, left: 0, aspectRatio: 342 / 280 },
  coinBr: { position: 'absolute', right: 0, bottom: 0, aspectRatio: 409 / 217 },
  centre: { aspectRatio: 676 / 515 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  diamant: {
    position: 'absolute',
    left: '47.78%',
    top: '62.14%',
    width: '7.1%',
    aspectRatio: 48 / 55,
  },
  diamantInner: { flex: 1 },
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
    color: '#6b5f55',
    textAlign: 'center',
    opacity: 0.95,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotT: { backgroundColor: '#c45a2a' },
  dotO: { backgroundColor: '#5a7c3a' },
  dotG: { backgroundColor: '#b8860b' },
});
