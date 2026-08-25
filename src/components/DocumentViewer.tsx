import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from '@expo/vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors, Radius, Spacing } from '../theme';

function isPdfLike(uri: string, mime?: string | null, name?: string | null): boolean {
  const m = (mime || '').toLowerCase();
  if (m.includes('pdf') || m.includes('msword') || m.includes('officedocument')) return true;
  const s = (name || uri || '').toLowerCase();
  return s.endsWith('.pdf') || s.endsWith('.doc') || s.endsWith('.docx');
}

function isImageLike(uri: string, mime?: string | null, name?: string | null): boolean {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return true;
  const s = (name || uri || '').toLowerCase();
  return /\.(jpe?g|png|gif|webp|bmp)$/.test(s);
}

export type ViewerDoc = {
  uri: string;
  label: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export function useDocumentViewer() {
  const [doc, setDoc] = useState<ViewerDoc | null>(null);
  const [downloading, setDownloading] = useState(false);

  const open = (d: ViewerDoc | null) => {
    if (!d?.uri) return;
    setDoc(d);
  };

  const close = () => setDoc(null);

  const download = async () => {
    if (!doc?.uri) return;
    try {
      setDownloading(true);
      const isRemote = /^https?:\/\//i.test(doc.uri);
      let localUri = doc.uri;
      if (isRemote) {
        const name = doc.fileName || `document_${Date.now()}.${isPdfLike(doc.uri, doc.mimeType, doc.fileName) ? 'pdf' : 'jpg'}`;
        const tmp = (FileSystem as any).cacheDirectory + name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const dl = await (FileSystem as any).downloadAsync(doc.uri, tmp);
        localUri = dl.uri;
      }
      // Sur device, Sharing ouvre la feuille native (Enregistrer / Ouvrir avec)
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(localUri, {
          dialogTitle: doc.label || 'Document',
        });
      } else {
        Alert.alert('Document', localUri);
      }
    } catch (e: any) {
      Alert.alert('Téléchargement', e?.message || 'Impossible de télécharger le document.');
    } finally {
      setDownloading(false);
    }
  };

  const openExternal = async () => {
    // Pour PDF/Word hébergés en http : on passe par le téléchargement + share (même flux)
    await download();
  };

  return { doc, open, close, download, openExternal, downloading, isPdfLike, isImageLike };
}

export function DocumentViewerOverlay({
  viewerDoc,
  onClose,
  onDownload,
  downloading,
}: {
  viewerDoc: ViewerDoc | null;
  onClose: () => void;
  onDownload: () => void;
  downloading?: boolean;
}) {
  if (!viewerDoc) return null;
  const uri = viewerDoc.uri;
  const isPdf = isPdfLike(uri, viewerDoc.mimeType, viewerDoc.fileName);
  const isImg = !isPdf && isImageLike(uri, viewerDoc.mimeType, viewerDoc.fileName);
  return (
    <Modal visible={!!viewerDoc} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <View style={s.headerIcon}>
              <Icon name={isPdf ? 'file-pdf-box' : isImg ? 'image-outline' : 'file-document-outline'} size={18} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title} numberOfLines={1}>{viewerDoc.label}</Text>
              {(viewerDoc.fileName || viewerDoc.mimeType) ? (
                <Text style={s.subtitle} numberOfLines={1}>{viewerDoc.fileName || viewerDoc.mimeType || ''}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
            <Icon name="close" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={s.body}>
          {isImg ? (
            <Image source={{ uri }} style={s.image} resizeMode="contain" />
          ) : (
            <View style={s.fileCard}>
              <View style={s.fileIconWrap}>
                <Icon name={isPdf ? 'file-pdf-box' : 'file-word-outline'} size={56} color={Colors.primary} />
              </View>
              <Text style={s.fileName} numberOfLines={2}>{viewerDoc.fileName || viewerDoc.label}</Text>
              <Text style={s.fileHint}>{isPdf ? 'PDF' : 'Document'} • ouvrez ou téléchargez le fichier</Text>
              <TouchableOpacity style={s.primaryBtn} onPress={onDownload} activeOpacity={0.85} disabled={!!downloading}>
                {downloading ? <ActivityIndicator color="#FFF" /> : <Icon name="download-outline" size={18} color="#FFF" />}
                <Text style={s.primaryBtnText}>{downloading ? 'Préparation…' : 'Ouvrir / Télécharger'}</Text>
              </TouchableOpacity>
              <Text style={s.fileUrl} numberOfLines={1}>{uri}</Text>
            </View>
          )}
        </View>

        {/* Footer actions */}
        <View style={s.footer}>
          <TouchableOpacity style={s.footerBtn} onPress={onDownload} disabled={!!downloading}>
            <Icon name="download-outline" size={18} color="#FFF" />
            <Text style={s.footerBtnText}>{downloading ? '…' : 'Télécharger'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.footerBtn, s.footerBtnGhost]} onPress={onClose}>
            <Text style={s.footerBtnGhostText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,14,20,0.96)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.12)' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  image: { width: '100%', height: '100%' },
  fileCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: Radius.lg, padding: Spacing.xl, alignItems: 'center', gap: 10 },
  fileIconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: Colors.primary + '14', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginTop: 4 },
  fileHint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  primaryBtn: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999 },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  fileUrl: { marginTop: 6, fontSize: 10, color: Colors.textTertiary, textAlign: 'center', maxWidth: '100%' },
  footer: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.14)', paddingVertical: 12, borderRadius: 12 },
  footerBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  footerBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  footerBtnGhostText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
