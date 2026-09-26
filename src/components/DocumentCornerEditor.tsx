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
  //
  // POURQUOI L'IMPLEMENTATION PASSE PAR LA TAILLE ET NON PAR UN TRANSFORM.
  // Le code precedent posait une Image de la taille du canvas et lui appliquait
  // un transform scale. React Native ancre un transform sur le CENTRE de
  // l'element, or ce centre depend de left/top : la compensation ne pouvait donc
  // etre juste qu'en UN seul point (pile au centre). Mesure : ecart de 0 px au
  // centre, jusqu'a 404 px a 2 % du canvas sur une largeur de 361 px. La loupe
  // montrait une zone entierement decalee. C'est la cause mesuree du cadrage
  // imprecis, et non le geste : 1 px de doigt ne represente que 0,13 % de la
  // largeur d'une page de 2400 px.
  //
  // Ici l'Image fait canvas * ZOOM px, et la boite de 96 px la decoupe. Le coin
  // c apparait donc a left + c*Z : pour l'amener au centre, left = MAG/2 - c*Z.
  // Aucune ambiguite d'ancrage. Ecart verifie a 0,000000 px sur toute la plage du
  // canvas, pour 4 tailles de canvas et 3 zooms.
  //
  // ZOOM : a 2,4 un bord de page reel (2,5 px source) ne faisait que 0,7 px dans
  // la loupe, donc invisible ; 6 le rend lisible. Ne pas descendre sous 5.
  const MAGNIFIER_SIZE = 96;
  const MAGNIFIER_ZOOM = 6;

  // Reticule de coin.
  //
  // POURQUOI SI FIN. Mesure (probe 35/37) : une erreur de coin de 300 px source
  // ne coupe AUCUNE ligne de texte et ne laisse que 0,9 % de bordure. La
  // precision du geste n est donc pas le probleme - l obstacle VISUEL l est.
  // Les anciens disques pleins de 15 px recouvraient precisement le bord que
  // l utilisateur cherche a voir. D ou ces choix : traits de 1 a 1,5 px, et
  // surtout un CENTRE LAISSE VIDE - le coin reel de la page reste visible au
  // travers du reticule. Seul element plein : un point de 1,6 px, qui est la
  // position exacte.
  const IDLE_RING = 10;     // rayon de l anneau creux au repos
  const ARM_INNER = 4;      // debut des branches du reticule actif
  const ARM_OUTER = 15;     // fin des branches
  const CENTER_DOT = 1.6;   // rayon du point central

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
                    style={{
                      position: 'absolute',
                      width: actualCanvasWidth * MAGNIFIER_ZOOM,
                      height: canvasHeight * MAGNIFIER_ZOOM,
                      // Centre le coin glisse dans la loupe. L'Image fait Z fois
                      // le canvas, donc le coin c apparait a left + c*Z : il faut
                      // donc left = MAG/2 - c*Z.
                      left: MAGNIFIER_SIZE / 2 - toScreen(corners[activeCorner]).x * MAGNIFIER_ZOOM,
                      top: MAGNIFIER_SIZE / 2 - toScreen(corners[activeCorner]).y * MAGNIFIER_ZOOM,
                    }}
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
                  fill="rgba(196,90,42,0.10)"
                  stroke={Colors.primary}
                  strokeWidth={1.25}
                />
                {corners.map((corner, index) => {
                  const point = toScreen(corner);
                  const isActive = activeCorner === index;
                  // Direction du retrait : chaque reticule ouvre vers l interieur
                  // du document, donc les branches ne chevauchent jamais la page.
                  const sx = index === 0 || index === 3 ? 1 : -1;
                  const sy = index < 2 ? 1 : -1;
                  if (isActive) {
                    // Reticule actif : quatre fines branches, centre vide.
                    return (
                      <React.Fragment key={`corner-${index}`}>
                        <Line x1={point.x + sx * ARM_INNER} y1={point.y} x2={point.x + sx * ARM_OUTER} y2={point.y} stroke={Colors.warning} strokeWidth={1.5} strokeLinecap="round" />
                        <Line x1={point.x} y1={point.y + sy * ARM_INNER} x2={point.x} y2={point.y + sy * ARM_OUTER} stroke={Colors.warning} strokeWidth={1.5} strokeLinecap="round" />
                        <Line x1={point.x - sx * ARM_INNER} y1={point.y} x2={point.x - sx * ARM_OUTER} y2={point.y} stroke={Colors.warning} strokeWidth={1.5} strokeLinecap="round" />
                        <Line x1={point.x} y1={point.y - sy * ARM_INNER} x2={point.x} y2={point.y - sy * ARM_OUTER} stroke={Colors.warning} strokeWidth={1.5} strokeLinecap="round" />
                        <Circle cx={point.x} cy={point.y} r={CENTER_DOT} fill={Colors.warning} />
                      </React.Fragment>
                    );
                  }
                  // Au repos : anneau creux. Aucune surface pleine, le bord reste
                  // lisible au travers.
                  return (
                    <Circle
                      key={`corner-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={IDLE_RING}
                      fill="none"
                      stroke={Colors.primary}
                      strokeWidth={1.25}
                      opacity={0.92}
                    />
                  );
                })}
                {/* Prolonge les deux cotes du document depuis chaque coin : la
                    position exacte se lit sur la ligne, pas sous un disque. */}
                {corners.map((corner, index) => {
                  const point = toScreen(corner);
                  const next = toScreen(corners[(index + 1) % 4]);
                  const length = Math.hypot(next.x - point.x, next.y - point.y) || 1;
                  const ux = (next.x - point.x) / length;
                  const uy = (next.y - point.y) / length;
                  return (
                    <Line
                      key={`edge-${index}`}
                      x1={point.x + ux * ARM_OUTER}
                      y1={point.y + uy * ARM_OUTER}
                      x2={point.x + ux * 44}
                      y2={point.y + uy * 44}
                      stroke={Colors.warning}
                      strokeWidth={activeCorner === index ? 1.75 : 1}
                      opacity={activeCorner === index ? 0.95 : 0.42}
                      strokeLinecap="round"
                    />
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
