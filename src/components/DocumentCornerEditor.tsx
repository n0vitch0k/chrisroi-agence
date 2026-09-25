import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Line, Polygon } from 'react-native-svg';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Radius, Shadows, Spacing } from '../theme';
import SafeButton from './SafeButton';
import type { ScanCorner } from '../utils/documentScan';

type Props = {
  visible: boolean;
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  initialCorners: ScanCorner[];
  onCancel: () => void;
  onApply: (corners: ScanCorner[]) => Promise<void>;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Rayon de saisie, en pixels ecran. Sans seuil, un toucher a 200 px d'un coin
 * le selectionne quand meme : la poignee ne peut pas etre posee avec precision.
 */
const TOUCH_RADIUS = 34;

const normalize = (corners: ScanCorner[]): ScanCorner[] =>
  corners.length === 4
    ? corners.map((corner) => ({ x: clamp01(corner.x), y: clamp01(corner.y) }))
    : [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];

const hasValidQuad = (points: ScanCorner[]): boolean => {
  if (points.length !== 4) return false;
  const sides = [0, 1, 2, 3].map((index) => {
    const a = points[index];
    const b = points[(index + 1) % 4];
    return Math.hypot(a.x - b.x, a.y - b.y);
  });
  if (Math.min(...sides) < 0.025) return false;
  const crosses = [0, 1, 2, 3].map((index) => {
    const a = points[index];
    const b = points[(index + 1) % 4];
    const c = points[(index + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  return crosses.every((value) => value > 0.000001) || crosses.every((value) => value < -0.000001);
};

const cornerNames = ['Haut gauche', 'Haut droit', 'Bas droit', 'Bas gauche'];

export default function DocumentCornerEditor({
  visible,
  sourceUri,
  sourceWidth,
  sourceHeight,
  initialCorners,
  onCancel,
  onApply,
}: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [corners, setCorners] = useState<ScanCorner[]>(() => normalize(initialCorners));
  const [activeCorner, setActiveCorner] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<number | null>(null);
  const cornerKey = JSON.stringify(initialCorners);

  useEffect(() => {
    if (!visible) return;
    setCorners(normalize(initialCorners));
    setActiveCorner(null);
    setSubmitting(false);
    setError(null);
    activeRef.current = null;
  }, [visible, cornerKey]);

  const canvasWidth = Math.min(560, Math.max(240, windowWidth - 32));
  const sourceRatio = sourceWidth > 0 && sourceHeight > 0 ? sourceHeight / sourceWidth : 1;
  const maxCanvasHeight = Math.max(300, Math.min(620, windowHeight * 0.66));
  const proposedHeight = canvasWidth * sourceRatio;
  const canvasHeight = proposedHeight > maxCanvasHeight
    ? maxCanvasHeight
    : proposedHeight;
  const actualCanvasWidth = Math.min(canvasWidth, canvasHeight / Math.max(sourceRatio, 0.01));
  // Loupe : agrandit la zone sous le coin glisse pour poser le bord avec precision.
  const MAGNIFIER_SIZE = 96;
  const MAGNIFIER_ZOOM = 2.4;

  const toScreen = (corner: ScanCorner) => ({
    x: corner.x * actualCanvasWidth,
    y: corner.y * canvasHeight,
  });

  // Les dimensions et les coins sont lus par REF, pas captures : le PanResponder
  // est donc cree UNE seule fois. Avant, il etait reconstruit a chaque frame
  // (useMemo dependait de `corners`) et le doigt perdait la saisie en cours de
  // deplacement - c'etait la source directe de l'imprecision du recadrage.
  const metricsRef = useRef({ width: actualCanvasWidth, height: canvasHeight });
  metricsRef.current = { width: actualCanvasWidth, height: canvasHeight };
  const cornersRef = useRef(corners);
  cornersRef.current = corners;

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { locationX, locationY } = event.nativeEvent;
        const { width, height } = metricsRef.current;
        const current = cornersRef.current;
        let nearest: number | null = null;
        let nearestDistance = TOUCH_RADIUS;
        current.forEach((corner, index) => {
          const point = { x: corner.x * width, y: corner.y * height };
          const distance = Math.hypot(point.x - locationX, point.y - locationY);
          // Rayon de saisie : au-dela, on ignore le toucher plutot que de
          // selectionner un coin que l'utilisateur ne visait pas.
          if (distance < nearestDistance) {
            nearest = index;
            nearestDistance = distance;
          }
        });
        activeRef.current = nearest;
        setActiveCorner(nearest);
      },
      onPanResponderMove: (event) => {
        const index = activeRef.current;
        if (index === null) return;
        const { locationX, locationY } = event.nativeEvent;
        const { width, height } = metricsRef.current;
        const next = {
          x: clamp01(locationX / width),
          y: clamp01(locationY / height),
        };
        setCorners((previous) => previous.map((corner, cornerIndex) => (
          cornerIndex === index ? next : corner
        )));
      },
      onPanResponderRelease: () => {
        activeRef.current = null;
        setActiveCorner(null);
      },
      onPanResponderTerminate: () => {
        activeRef.current = null;
        setActiveCorner(null);
      },
    }),
    [],
  );

  const handleApply = async () => {
    if (!hasValidQuad(corners)) {
      setError('Les quatre coins doivent former un quadrilatère non croisé et sufficiently espacés.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onApply(corners);
    } catch (submissionError: any) {
      setError(submissionError?.message || 'Impossible d’appliquer le recadrage.');
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !submitting && onCancel()}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Corriger la page</Text>
              <Text style={styles.subtitle}>Recadrage manuel : aucune détection automatique</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer la correction"
              disabled={submitting}
              onPress={onCancel}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          <View style={[styles.canvasWrap, { width: actualCanvasWidth, height: canvasHeight }]}>
            <Image
              source={{ uri: sourceUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="stretch"
              accessibilityLabel="Photo à recadrer"
            />
            <View
              style={StyleSheet.absoluteFill}
              {...panResponder.panHandlers}
              accessible={false}
            >
              {activeCorner !== null && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.magnifier,
                    {
                      width: MAGNIFIER_SIZE,
                      height: MAGNIFIER_SIZE,
                      left: Math.max(
                        0,
                        Math.min(
                          actualCanvasWidth - MAGNIFIER_SIZE,
                          toScreen(corners[activeCorner]).x - MAGNIFIER_SIZE / 2,
                        ),
                      ),
                      top: Math.max(
                        0,
                        Math.min(
                          canvasHeight - MAGNIFIER_SIZE,
                          toScreen(corners[activeCorner]).y - MAGNIFIER_SIZE / 2,
                        ),
                      ),
                    },
                  ]}
                >
                  <Image
                    source={{ uri: sourceUri }}
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        width: actualCanvasWidth,
                        height: canvasHeight,
                        left: -toScreen(corners[activeCorner]).x + MAGNIFIER_SIZE / 2,
                        top: -toScreen(corners[activeCorner]).y + MAGNIFIER_SIZE / 2,
                        transform: [{ scale: MAGNIFIER_ZOOM }],
                      },
                    ]}
                    resizeMode="cover"
                  />
                  <View style={styles.magnifierCrosshair} pointerEvents="none" />
                </View>
              )}
              <Svg width="100%" height="100%" viewBox={`0 0 ${actualCanvasWidth} ${canvasHeight}`} pointerEvents="none">
                <Polygon
                  points={corners.map((corner) => {
                    const point = toScreen(corner);
                    return `${point.x},${point.y}`;
                  }).join(' ')}
                  fill="rgba(196,90,42,0.16)"
                  stroke={Colors.primary}
                  strokeWidth={3}
                />
                {corners.map((corner, index) => {
                  const point = toScreen(corner);
                  return (
                    <React.Fragment key={`corner-${index}`}>
                      <Circle
                        cx={point.x}
                        cy={point.y}
                        r={activeCorner === index ? 18 : 15}
                        fill={activeCorner === index ? Colors.warning : Colors.primary}
                        stroke={Colors.surface}
                        strokeWidth={3}
                      />
                      <Line
                        x1={point.x}
                        y1={point.y}
                        x2={point.x + (index === 0 ? 1 : index === 1 ? -1 : index === 2 ? -1 : 1) * 10}
                        y2={point.y + (index < 2 ? 1 : -1) * 10}
                        stroke={Colors.surface}
                        strokeWidth={2}
                      />
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </View>

          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <Icon name="crop-free" size={16} color={Colors.textSecondary} />
              <Text style={styles.legendHint}>
                Glisse les coins sur les quatre bords du document
              </Text>
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actions}>
            <SafeButton
              mode="outlined"
              onPress={onCancel}
              disabled={submitting}
              style={styles.action}
              color={Colors.textSecondary}
            >
              Annuler
            </SafeButton>
            <SafeButton
              mode="contained"
              onPress={handleApply}
              loading={submitting}
              disabled={submitting}
              style={styles.action}
            >
              {submitting ? 'Traitement…' : 'Appliquer'}
            </SafeButton>
          </View>
          {submitting && (
            <View style={styles.processingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.processingText}>Recadrage et amélioration en cours…</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 13, 9, 0.62)',
  },
  sheet: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxl : Spacing.lg,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    backgroundColor: Colors.bg,
    ...Shadows.elevated,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerCopy: { flex: 1, paddingRight: Spacing.md },
  title: { fontSize: 21, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary, marginTop: 3 },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: Colors.surfaceAlt,
  },
  closeText: { fontSize: 25, lineHeight: 27, color: Colors.textSecondary },
  canvasWrap: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: Radius.md,
    backgroundColor: '#241a14',
    ...Shadows.card,
  },
  legend: {
    marginTop: Spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  legendHint: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary, flex: 1 },
  magnifier: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: Colors.warning,
    backgroundColor: '#241a14',
  },
  magnifierCrosshair: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  error: {
    marginTop: Spacing.md,
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  action: { flex: 1 },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  processingText: { fontSize: 12, color: Colors.textSecondary },
});
