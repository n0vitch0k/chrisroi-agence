// ─── Feuille d'actions (bottom sheet) ──────────────────────────────
// Un menu contextuel qui remonte du bas, dans le thème Warm Earth.
//
// Pourquoi pas Alert.alert() : le dialogue natif Android sort du thème
// (fond gris système, police système, boutons tout en bas à droite) et
// n'est pas lisible sur les écrans de l'app. Ici tout reste dans la palette
// terracotta/or et passe par le même contrôle de thème comme le recadrage
// du scan (DocumentCornerEditor).
//
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Radius, Shadows } from '../theme';

const M = Colors;

// Ferme la feuille, puis joue l'action sur le tick SUIVANT. Sur Android, monter
// un nouveau Modal (le formulaire) ou afficher une Alert native dans la même
// frame que la fermeture de l'ancien Modal est ignored : l'alerte de
// suppression n'apparaîtrait pas, le formulaire ne s'ouvrirait pas. Le tick
// d'après laisse le démontage se terminer.
const apresFermeture = (fermer: () => void, action: () => void) => {
  fermer();
  setTimeout(action, 0);
};

export interface ActionSheetItem {
  label: string;
  icon: string;
  /** 'default' | 'danger' — 'danger' colore le libellé et l'icône en rouge. */
  tone?: 'default' | 'danger';
  onPress: () => void;
}

export default function ActionSheet({
  visible,
  titre,
  sousTitre,
  actions,
  onClose,
}: {
  visible: boolean;
  titre?: string;
  sousTitre?: string;
  actions: ActionSheetItem[];
  onClose: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Le fond se ferme au tap ; la fiche elle-même intercepte le tap pour
            qu'on ne la ferme pas en voulant lire un libellé. */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.poignee} />
          <View style={styles.head}>
            <View style={styles.headCopy}>
              {titre ? <Text style={styles.title}>{titre}</Text> : null}
              {sousTitre ? <Text style={styles.subtitle}>{sousTitre} </Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
              <Icon name="close" size={22} color={M.textTertiary} />
            </TouchableOpacity>
          </View>

          {actions.length > 0 ? (
            <View style={styles.liste}>
              {actions.length === 1 ? (
                <TouchableOpacity
                  style={[styles.item, styles.itemSeul]}
                  onPress={() => apresFermeture(onClose, actions[0].onPress)}
                  activeOpacity={0.7}
                >
                  <Icon name={actions[0].icon} size={22} color={actions[0].tone === 'danger' ? M.danger : M.primary} />
                  <Text
                    style={[styles.itemLabel, actions[0].tone === 'danger' && styles.itemLabelDanger]}
                    numberOfLines={1}
                  >
                    {actions[0].label}
                  </Text>
                </TouchableOpacity>
              ) : (
                actions.map((a, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.item, i > 0 && styles.itemSuivant]}
                    onPress={() => apresFermeture(onClose, a.onPress)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={a.label}
                  >
                    <Icon name={a.icon} size={22} color={a.tone === 'danger' ? M.danger : M.primary} />
                    <Text
                      style={[styles.itemLabel, a.tone === 'danger' && styles.itemLabelDanger]}
                      numberOfLines={1}
                    >
                      {a.label}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : (
            <Text style={styles.vide}>Aucune action disponible.</Text>
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
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: M.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    ...Shadows.elevated,
  },
  // Poignée de glissement : purement visuelle, la fiche ne se glisse pas.
  poignee: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: M.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  headCopy: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: M.textPrimary, lineHeight: 21 },
  subtitle: { fontSize: 12, color: M.textTertiary, marginTop: 2 },
  close: { padding: 2 },
  liste: { borderTopWidth: 1, borderTopColor: M.borderSoft },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  // Sépare les items quand il y en a plusieurs : deux lignes de 52px sans
  // séparation se lisent comme un seul bouton de 104px.
  itemSuivant: { borderTopWidth: 1, borderTopColor: M.borderSoft },
  itemSeul: { paddingVertical: Spacing.md },
  itemLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: M.textPrimary },
  itemLabelDanger: { color: M.danger },
  vide: { fontSize: 13, color: M.textTertiary, textAlign: 'center', paddingVertical: Spacing.md },
});
