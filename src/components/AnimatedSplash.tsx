import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import * as Font from 'expo-font';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Path,
  Circle,
  Rect,
  G,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import ReAnimated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing as ReEasing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// ── Vagues validees (maquettes V10-V13) : morph continu des paths ─────────────
function tlBase(s: number): [number, number] {
  'worklet';
  const x = 390 - s * 390;
  const y = 42 + s * 244 - Math.sin(s * Math.PI) * 36;
  return [x, y];
}

function brBase(s: number): [number, number] {
  'worklet';
  const x = s * 390;
  const y = 738 - s * 244 + Math.sin(s * Math.PI) * 36;
  return [x, y];
}

function waveD(
  kind: 'tl' | 'br' | 'tle' | 'bre',
  t: number,
  amp: number,
  ph: number,
): string {
  'worklet';
  const N = 24;
  const fn = kind === 'tl' || kind === 'tle' ? tlBase : brBase;
  const pts: [number, number][] = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    const p = fn(s);
    const env = Math.sin(Math.PI * s);
    const w = Math.sin(s * Math.PI + t + ph) * amp * env;
    pts.push([p[0] + w * 0.45, p[1] + w + (kind === 'tle' || kind === 'bre' ? 7 : 0)]);
  }
  let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(pts.length - 1, k + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d +=
      ' C' +
      c1x.toFixed(1) +
      ' ' +
      c1y.toFixed(1) +
      ' ' +
      c2x.toFixed(1) +
      ' ' +
      c2y.toFixed(1) +
      ' ' +
      p2[0].toFixed(1) +
      ' ' +
      p2[1].toFixed(1);
  }
  if (kind === 'tl') return d + ' L-15 300 L-15 -15 L405 -15 L405 42 Z';
  if (kind === 'br') return d + ' L405 480 L405 795 L-15 795 L-15 738 Z';
  return d;
}

const APath = ReAnimated.createAnimatedComponent(Path);
const ARotG = ReAnimated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);
const AG = Animated.createAnimatedComponent(G);
const AText = Animated.createAnimatedComponent(SvgText);

interface AnimatedSplashProps {
  onFinish?: () => void;
  statusText?: string;
}

// Sceau prestige C1 (valide en maquette V13) : anneau texte circulaire rotatif,
// guilloche concentrique, disque terracotta degrade, CA or, losange + halo.
export default function AnimatedSplash({ onFinish, statusText }: AnimatedSplashProps) {
  const medal = useRef(new Animated.Value(0)).current;
  const brand = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const bgPhase = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const [fontsLoaded, setFontsLoaded] = React.useState(false);

  // Horloge UI-thread pour les vagues + la rotation de l'anneau texte
  const clock = useSharedValue(0);

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
    clock.value = withRepeat(withTiming(200, { duration: 200000, easing: ReEasing.linear }), -1, false);
    return () => {
      cancelAnimation(clock);
    };
  }, [fontsLoaded, clock]);

type WaveKind = 'tl' | 'br' | 'tle' | 'bre';

function useWaveD(clock: SharedValue<number>, kind: WaveKind, ph: number) {
  return useAnimatedProps(() => {
    'worklet';
    const t = clock.value;
    const intro = Math.min(1, t / 2.6);
    const amp = 8 * (0.3 + 0.7 * intro);
    return { d: waveD(kind, t * 1.05, amp, ph) };
  });
}

  const ringRot = useAnimatedProps(() => {
    'worklet';
    return { rotation: (clock.value * 360) / 70 % 360 };
  });

  const tlP = useWaveD(clock, 'tl', 0);
  const tlE = useWaveD(clock, 'tle', 0);
  const brP = useWaveD(clock, 'br', 2.6);
  const brE = useWaveD(clock, 'bre', 2.6);

  useEffect(() => {
    if (!fontsLoaded) return;

    const tMedal = Animated.timing(medal, {
      toValue: 1,
      duration: 900,
      delay: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    const tBrand = Animated.timing(brand, {
      toValue: 1,
      duration: 800,
      delay: 1400,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    const tBg = Animated.timing(bgPhase, {
      toValue: 1,
      duration: 960,
      delay: 1216,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    });
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(halo, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );

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

    tMedal.start();
    tBrand.start();
    tBg.start();
    haloLoop.start();

    const timer = setTimeout(() => onFinish?.(), 3800);
    return () => {
      clearTimeout(timer);
      clearTimeout(dotStart);
      haloLoop.stop();
      loop1.stop();
      loop2.stop();
      loop3.stop();
    };
  }, [fontsLoaded, onFinish, medal, brand, halo, bgPhase, dot1, dot2, dot3]);

  if (!fontsLoaded) {
    return <View style={s.fallback} />;
  }

  const medalOp = medal.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const medalTy = medal.interpolate({ inputRange: [0, 1], outputRange: [-14, 0], extrapolate: 'clamp' });
  const brandOp = brand.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const brandTy = brand.interpolate({ inputRange: [0, 1], outputRange: [12, 0], extrapolate: 'clamp' });
  const haloOp = halo.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.6], extrapolate: 'clamp' });

  // Couleurs Nuit -> Jour (JS thread)
  const bgColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#0d0a09', '#faf1e8'], extrapolate: 'clamp' }) as any;
  const brandColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#f5e6c8', '#3d1e0a'], extrapolate: 'clamp' }) as any;
  const subColor = bgPhase.interpolate({ inputRange: [0, 1], outputRange: ['#d4a853', '#8a7a6a'], extrapolate: 'clamp' }) as any;
  const statusColor = bgPhase.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.88)', '#6b5f55'],
    extrapolate: 'clamp',
  }) as any;

  const dotTy1 = dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotTy2 = dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });
  const dotTy3 = dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -12], extrapolate: 'clamp' });

  return (
    <View style={s.root}>
      <Animated.View style={[s.bg, { backgroundColor: bgColor }]} />

      <Svg width="100%" height="100%" viewBox="0 0 390 780" preserveAspectRatio="xMidYMid slice" style={s.svg}>
        <Defs>
          <LinearGradient id="terra" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#cc6641" />
            <Stop offset="100%" stopColor="#b4532a" />
          </LinearGradient>
          <LinearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#c9a86a" />
            <Stop offset="100%" stopColor="#f4d585" />
          </LinearGradient>
          <RadialGradient id="haloG" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#f4d585" stopOpacity={0.85} />
            <Stop offset="45%" stopColor="#f4d585" stopOpacity={0.28} />
            <Stop offset="100%" stopColor="#f4d585" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="disc" cx="50%" cy="38%" r="75%">
            <Stop offset="0%" stopColor="#d4714a" />
            <Stop offset="70%" stopColor="#c45a2a" />
            <Stop offset="100%" stopColor="#a34a24" />
          </RadialGradient>
          <Path id="tp" d="M195,348 m-90,0 a90,90 0 1,1 180,0 a90,90 0 1,1 -180,0" fill="none" />
        </Defs>

        {/* Vagues des coins validees */}
        <APath animatedProps={tlP} fill="url(#terra)" />
        <APath animatedProps={tlE} fill="none" stroke="url(#gold)" strokeWidth={1.8} strokeLinecap="round" />
        <APath animatedProps={brP} fill="url(#terra)" />
        <APath animatedProps={brE} fill="none" stroke="url(#gold)" strokeWidth={1.8} strokeLinecap="round" />

        {/* Sceau prestige C1 */}
        <AG opacity={medalOp} transform={[{ translateY: medalTy }]}>
          <Circle cx={195} cy={348} r={112} fill="none" stroke="url(#gold)" strokeWidth={2} />
          <Circle cx={195} cy={348} r={106} fill="url(#disc)" />
          <Circle cx={195} cy={348} r={106} fill="none" stroke="url(#gold)" strokeWidth={1} />
          <G opacity={0.5} fill="none" stroke="#f4d585" strokeWidth={0.7}>
            <Circle cx={195} cy={348} r={98} strokeDasharray="1 3" />
            <Circle cx={195} cy={348} r={82} strokeDasharray="1 2.5" />
            <Circle cx={195} cy={348} r={70} strokeDasharray="1 2" />
          </G>
          <ARotG animatedProps={ringRot} originX={195} originY={348}>
            <SvgText fontFamily="Plus Jakarta Sans" fontSize={11.5} letterSpacing={2.5} fill="#f4d585" textLength={560} lengthAdjust="spacingAndGlyphs">
              <TextPath href="#tp">CHRISROI AGENCE • L'EXCELLENCE A VOTRE SERVICE • </TextPath>
            </SvgText>
          </ARotG>
          <Rect x={-4} y={-4} width={8} height={8} fill="url(#gold)" transform="translate(195,236) rotate(45)" />
          <Rect x={-4} y={-4} width={8} height={8} fill="url(#gold)" transform="translate(195,460) rotate(45)" />
          <SvgText x={172} y={378} textAnchor="middle" fontFamily="CormorantLight" fontSize={80} fill="url(#gold)">
            C
          </SvgText>
          <SvgText x={222} y={378} textAnchor="middle" fontFamily="CormorantLight" fontSize={80} fill="url(#gold)">
            A
          </SvgText>
        </AG>

        {/* Halo + losange */}
        <ACircle cx={195} cy={484} r={26} fill="url(#haloG)" opacity={haloOp as any} />
        <AG opacity={medalOp as any}>
          <Rect x={-10} y={-10} width={20} height={20} fill="url(#gold)" transform="translate(195,484) rotate(45)" />
        </AG>

        {/* Marque */}
        <AG opacity={brandOp as any} transform={[{ translateY: brandTy as any }]}>
          <AText x={195} y={604} textAnchor="middle" fontFamily="CormorantLight" fontSize={37} fill={brandColor}>
            Chrisroi Agence
          </AText>
          <SvgText x={195} y={634} textAnchor="middle" fontFamily="Plus Jakarta Sans" fontSize={9} letterSpacing={3.6} fill={subColor}>
            L'EXCELLENCE A VOTRE SERVICE
          </SvgText>
        </AG>
      </Svg>

      {statusText ? (
        <View style={s.statusWrap}>
          <Animated.Text style={[s.statusText, { color: statusColor }]}>{statusText}</Animated.Text>
        </View>
      ) : null}

      <View style={s.dotsRow}>
        <Animated.View style={[s.dot, s.dotT, { transform: [{ translateY: dotTy1 }] }]} />
        <Animated.View style={[s.dot, s.dotO, { transform: [{ translateY: dotTy2 }] }]} />
        <Animated.View style={[s.dot, s.dotG, { transform: [{ translateY: dotTy3 }] }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: '#0d0a09' },
  root: { flex: 1, backgroundColor: '#0d0a09', alignItems: 'center', justifyContent: 'center' },
  bg: { ...StyleSheet.absoluteFillObject },
  svg: { ...StyleSheet.absoluteFillObject },
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
