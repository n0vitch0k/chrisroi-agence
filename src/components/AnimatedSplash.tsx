import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Dimensions } from 'react-native';
import {
  Canvas,
  Path,
  Text,
  Rect,
  Group,
  LinearGradient,
  vec,
  useFont,
  Skia,
  Paint,
} from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish?: () => void;
}

const BG_C_PATH = 'M 210 75 C 170 28, 95 24, 70 72 C 42 130, 60 210, 118 235 C 162 254, 205 244, 225 210';

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const chrisRoiFont = useFont(require('../../assets/fonts/GreatVibes-Regular.ttf'), 58);
  const agenceFont = useFont(require('../../assets/fonts/CormorantGaramond-Light.ttf'), 14);

  const [time, setTime] = useState(0);
  const startTime = useRef(Date.now());
  const onFinishCalled = useRef(false);

  useEffect(() => {
    startTime.current = Date.now();
    let raf: number;

    const tick = () => {
      const elapsed = (Date.now() - startTime.current) / 1000;
      setTime(elapsed);

      if (elapsed > 5.5 && onFinish && !onFinishCalled.current) {
        onFinishCalled.current = true;
        onFinish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onFinish]);

  // Compute progress values
  const drawProgress = time < 0.3 ? 0 : time > 2.8 ? 1 : (time - 0.3) / 2.5;
  const revealProgress = time < 1.5 ? 0 : time > 4 ? 1 : (time - 1.5) / 2.5;
  const subtitleOpacity = time < 4 ? 0 : time > 5 ? 1 : (time - 4);

  // Compute trimmed path for C background (trim takes 0..1 values, no getLength needed)
  const fullPath = Skia.Path.MakeFromSVGString(BG_C_PATH)!;
  const trimmedCPath = fullPath.trim(0, drawProgress, false);

  if (!chrisRoiFont || !agenceFont) return null;

  const textWidth = 260;
  const textX = width / 2 - textWidth / 2;
  const textY = height / 2;

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0a09' }}>
      <Canvas style={{ flex: 1 }}>
        {/* Background gradient */}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, height)}
            colors={['#14100e', '#0d0a09', '#110d0b']}
          />
        </Rect>

        {/* C background path with trim */}
        <Path path={trimmedCPath} style="stroke" strokeWidth={1.5} strokeCap="round">
          <Paint color="rgba(212,168,83,0.08)" />
        </Path>

        {/* ChrisRoi with clip reveal */}
        <Group>
          <Group clip={{ rect: { x: textX, y: textY - 40, width: textWidth * revealProgress, height: 80 } }}>
            <Text x={textX} y={textY + 18} text="ChrisRoi" font={chrisRoiFont}>
              <Paint>
                <LinearGradient
                  start={vec(textX, 0)}
                  end={vec(textX + textWidth, 0)}
                  colors={['#f5e6c8', '#d4a853', '#b8860b']}
                />
              </Paint>
            </Text>
          </Group>
        </Group>

        {/* AGENCE subtitle */}
        <Text
          x={width / 2}
          y={textY + 58}
          text="AGENCE"
          font={agenceFont}
          opacity={subtitleOpacity}
        >
          <Paint color="#d4a853" />
        </Text>
      </Canvas>
    </View>
  );
}
