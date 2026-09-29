// ─── Sélecteur de mois (calendrier) ────────────────────────────────
// Pourquoi maison et non @react-native-community/datetimepicker :
// ce module est NATIF. Il fonctionnerait dans Expo Go, mais il faudrait un
// nouveau build APK pour le telephone, et il n'epouse pas le theme Warm Earth.
// Un calendrier en pur React Native marche partout, tout de suite, et se
// style comme le reste de l'app.
//
// Contrat : la valeur échangée est une CLÉ LOCALE « yyyy-mm-dd » (exactement
// ce qu'attend un <input type="date">), jamais un timestamp. Voir
// utils/cahierDates pour pourquoi le fuseau est un vrai piège ici.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Radius, Shadows } from '../theme';
import { localDayKey } from '../utils/cahierDates';

const M = Colors;

// Lundi en tete (convention francaise). getDay() : 0 = dimanche.
const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MOIS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function cle(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function MonthCalendar({
  visible,
  value,
  onSelect,
  onClose,
  titre = 'Choisir une date',
}: {
  visible: boolean;
  /** Clé « yyyy-mm-dd » actuellement sélectionnée, ou null. */
  value: string | null;
  onSelect: (day: string) => void;
  onClose: () => void;
  titre?: string;
}) {
  // Mois affiché : celui de la valeur si elle existe, sinon le mois courant.
  const [mois, setMois] = useState(() => {
    const base = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  // Grille de 6 semaines = 42 cases : hauteur stable, pas de saut quand on
  // passe d'un mois de 5 semaines a un mois de 6.
  const cases = useMemo(() => {
    const y = mois.getFullYear();
    const m = mois.getMonth();
    // Decalage pour que le 1er tombe sous le bon jour de semaine.
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const nbJours = new Date(y, m + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= nbJours; d++) out.push(cle(y, m, d));
    while (out.length < 42) out.push(null);
    return out;
  }, [mois]);

  const today = localDayKey(new Date());
  const y = mois.getFullYear();
  const m = mois.getMonth();

  const changerMois = (delta: number) => setMois(new Date(y, m + delta, 1));

  // Raccourcis : le cas d'usage reel d'un rappel d'appel est « dans 3 jours ».
  const raccourcis = [
    { label: "Aujourd'hui", day: today },
    { label: 'Demain', day: cle(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{titre}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={24} color={M.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Navigation de mois */}
          <View style={styles.moisBar}>
            <TouchableOpacity onPress={() => changerMois(-1)} hitSlop={10} style={styles.moisArrow}>
              <Icon name="chevron-left" size={26} color={M.primary} />
            </TouchableOpacity>
            <Text style={styles.moisLabel}>
              {MOIS_FR[m]} {y}
            </Text>
            <TouchableOpacity onPress={() => changerMois(1)} hitSlop={10} style={styles.moisArrow}>
              <Icon name="chevron-right" size={26} color={M.primary} />
            </TouchableOpacity>
          </View>

          {/* Jours de semaine */}
          <View style={styles.grille}>
            {JOURS_COURTS.map((j, i) => (
              <View key={i} style={styles.case}>
                <Text style={styles.jourSemaine}>{j}</Text>
              </View>
            ))}
          </View>

          {/* Jours */}
          <View style={styles.grille}>
            {cases.map((c, i) => {
              if (!c) return <View key={i} style={styles.case} />;
              const estAujourdhui = c === today;
              const estSelectionne = c === value;
              return (
                <View key={i} style={styles.case}>
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(c);
                      onClose();
                    }}
                    style={[
                      styles.jour,
                      estAujourdhui && !estSelectionne && styles.jourAujourdhui,
                      estSelectionne && styles.jourSelectionne,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.jourTexte,
                        estAujourdhui && !estSelectionne && styles.jourTexteAujourdhui,
                        estSelectionne && styles.jourTexteSelectionne,
                      ]}
                    >
                      {Number(c.slice(8))}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          {/* Raccourcis + annulation */}
          <View style={styles.pied}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.raccourcis}>
              {raccourcis.map((r) => (
                <TouchableOpacity
                  key={r.label}
                  onPress={() => {
                    onSelect(r.day);
                    onClose();
                  }}
                  style={styles.raccourci}
                  activeOpacity={0.7}
                >
                  <Text style={styles.raccourciTexte}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {value && (
              <TouchableOpacity onPress={() => { onSelect(''); onClose(); }} style={styles.annuler}>
                <Text style={styles.annulerTexte}>Effacer</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: M.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.elevated,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  title: { fontSize: 17, fontWeight: '800', color: M.textPrimary },
  moisBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  moisArrow: { padding: 4 },
  moisLabel: { fontSize: 15, fontWeight: '700', color: M.textPrimary, textTransform: 'capitalize' },
  grille: { flexDirection: 'row', flexWrap: 'wrap' },
  case: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  jourSemaine: { fontSize: 11, fontWeight: '700', color: M.textTertiary, paddingVertical: 6 },
  jour: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jourAujourdhui: { backgroundColor: M.primaryDim },
  jourSelectionne: { backgroundColor: M.primary },
  jourTexte: { fontSize: 14, color: M.textPrimary },
  jourTexteAujourdhui: { fontWeight: '700', color: M.primaryDark },
  jourTexteSelectionne: { color: '#fff', fontWeight: '700' },
  pied: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: Spacing.sm },
  raccourcis: { gap: 8, flex: 1 },
  raccourci: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: M.bg },
  raccourciTexte: { fontSize: 12, fontWeight: '600', color: M.textSecondary },
  annuler: { paddingHorizontal: 10, paddingVertical: 7 },
  annulerTexte: { fontSize: 13, fontWeight: '600', color: M.danger },
});
