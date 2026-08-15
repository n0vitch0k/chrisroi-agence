import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import { Colors, Spacing, Radius, Typography, Shadows } from '../theme';

// ─── Props ─────────────────────────────────────────────────
interface A4DocumentProps {
  children: React.ReactNode;
  title?: string;
  onPrint?: () => void;
  /** Callback de sauvegarde sans impression. Ajoute un bouton "Enregistrer" à côté du bouton Imprimer */
  onSave?: () => void;
  /** Callback déclenché APRÈS l'impression (après fermeture de la fenêtre print web, ou après onPrint mobile).
   *  Utilisé par les écrans pour proposer le scan du document signé. */
  onAfterPrint?: () => void;
  /** Remplacer les boutons d'impression/enregistrement par du custom */
  actions?: React.ReactNode;
  /** Nombre de pages A4 (défaut 1). Augmente la hauteur min pour le contenu multi-pages */
  pageCount?: number;
}

// ─── Ratio A4 : 210 x 297 mm ──────────────────────────────
const A4_RATIO = 210 / 297; // largeur / hauteur
// Dimensions.get fonctionne sur web ET natif (window.innerWidth est
// undefined sur natif → NaN → document invisible sur l'APK).
const DOC_WIDTH = 600; // largeur A4 réaliste (WYSIWYG papier), scroll horizontal si écran plus étroit
const DOC_HEIGHT = DOC_WIDTH / A4_RATIO;

// ─── Composant principal ──────────────────────────────────
export default function A4Document({
  children,
  title,
  onPrint,
  onSave,
  onAfterPrint,
  actions,
  pageCount = 1,
}: A4DocumentProps) {
  // ── Impression HTML ────────────────────────────────────
  const handlePrint = useCallback(() => {
    // Toujours sauvegarder d'abord si onPrint est fourni
    if (onPrint) onPrint();

    if (Platform.OS === 'web') {
      // On récupère le contenu du document pour l'impression
      const printContent = document.getElementById('a4-print-content');
      if (!printContent) return;

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const styles = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules || [])
              .map((rule) => rule.cssText)
              .join('\n');
          } catch {
            return '';
          }
        })
        .join('\n');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Inter', -apple-system, sans-serif; color: #000; }
            ${styles}
            .a4-edit-field { border-bottom: 1px solid #ccc; min-height: 18px; display: inline-block; min-width: 80px; background: #fafafa; }
            .a4-signature-box { border: 1px dashed #999; height: 60px; margin: 8px 0; display: flex; align-items: flex-end; justify-content: center; }
            .no-print { display: none !important; }
            .a4-controls, .a4-zoom-controls { display: none !important; }
            body { padding: 20px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }

    // Déclencher le callback post-impression (scan prompt, etc.)
    if (onAfterPrint) onAfterPrint();
  }, [onPrint, onAfterPrint]);

  // ── Rendu de la page A4 (partagé) ─────────────────────
  const renderPage = () => (
    <View
      style={[
        styles.a4Page,
        {
          width: DOC_WIDTH,
          minHeight: DOC_HEIGHT * pageCount,
        },
      ]}
    >
      <View id="a4-print-content" style={styles.a4Content}>
        {children}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        {/* Barre d'outils */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            {title && <Text style={styles.toolbarTitle}>{title}</Text>}
          </View>
          <View style={styles.toolbarRight}>
            {/* Actions */}
            {actions || (
              <View style={styles.actionGroup}>
                {onSave && (
                  <TouchableOpacity onPress={onSave} style={styles.saveBtn}>
                    <Icon
                      name="content-save-outline"
                      size={16}
                      color={Colors.textOnPrimary}
                    />
                    <Text style={styles.saveBtnText}>Enregistrer</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handlePrint} style={styles.printBtn}>
                  <Icon
                    name="printer-outline"
                    size={16}
                    color={Colors.textOnPrimary}
                  />
                  <Text style={styles.printBtnText}>Imprimer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Zone document : scroll horizontal + vertical (pas de zoom) */}
        <View style={styles.docZone}>
          <ScrollView
            horizontal
            style={styles.hScroll}
            contentContainerStyle={styles.hScrollContent}
            showsHorizontalScrollIndicator={true}
            bounces={false}
          >
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
              {renderPage()}
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#E5E5E5',
  },
  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    // Barre fixe : ne jamais s'étirer, rester compacte
    height: 52,
    flexShrink: 0,
  },
  toolbarLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  toolbarTitle: {
    ...Typography.titleSmall,
    color: Colors.textPrimary,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  // Actions
  actionGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  printBtnText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.textOnPrimary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.md,
    gap: Spacing.xs,
  },
  saveBtnText: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Zones de scroll
  docZone: {
    flex: 1,
    position: 'relative',
  },
  hScroll: {
    flex: 1,
  },
  hScrollContent: {
    minWidth: '100%',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  // Document
  a4Page: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    ...Shadows.card,
  },
  a4Content: {
    flexGrow: 1,
    padding: 24,
  },
});
