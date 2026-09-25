import { Platform } from 'react-native';
import { printToFileAsync } from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { shareBase64File } from './shareFile';

export type ScanPdfPage = {
  uri: string;
  label?: string;
};

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function localOrRemoteImageToDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Image inaccessible (${response.status}).`);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  let localUri = uri;
  if (/^https?:\/\//i.test(uri)) {
    const cacheDirectory = FileSystem.cacheDirectory;
    if (!cacheDirectory) throw new Error('Cache inaccessible.');
    localUri = `${cacheDirectory}scan_pdf_${Date.now()}_${Math.floor(Math.random() * 100000)}.jpg`;
    const download = await FileSystem.downloadAsync(uri, localUri);
    localUri = download.uri;
  }

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const extension = localUri.split('?')[0].split('.').pop()?.toLowerCase();
  const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${base64}`;
}

/** Génère et partage un PDF multipage à partir de pages redressées, dans l'ordre reçu. */
export async function shareScanPdf(
  pages: ScanPdfPage[],
  fileName: string,
  dialogTitle = 'Scan multipage',
): Promise<void> {
  if (pages.length === 0) throw new Error('Aucune page à convertir en PDF.');

  const imageTags = await Promise.all(
    pages.map(async (page, index) => {
      const image = await localOrRemoteImageToDataUri(page.uri);
      const label = escapeHtml(page.label || `Page ${index + 1}`);
      return `<section class="page"><div class="label">${label}</div><img src="${escapeHtml(image)}" /></section>`;
    }),
  );

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .page { width: 210mm; height: 297mm; padding: 8mm; position: relative; page-break-after: always; break-after: page; background: #fff; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .label { height: 6mm; font: 10px sans-serif; color: #666; }
  img { display: block; width: 100%; height: calc(100% - 6mm); object-fit: contain; }
</style></head><body>${imageTags.join('')}</body></html>`;

  if (Platform.OS === 'web') {
    const popup = window.open('', '_blank');
    if (!popup) throw new Error("La fenêtre d'impression a été bloquée.");
    popup.document.write(html);
    popup.document.close();
    popup.print();
    return;
  }

  const { base64 } = await printToFileAsync({ html, base64: true });
  if (!base64) throw new Error('Le PDF multipage est vide.');
  await shareBase64File(base64, fileName, dialogTitle, 'application/pdf');
}
