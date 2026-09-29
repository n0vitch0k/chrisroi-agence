import { Image } from 'react-native';
import { Buffer } from 'buffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Scanner documentaire local compatible Expo Go.
 *
 * Le redressement automatique des bords a été retiré : la détection angulaire
 * par Hough ne pouvait représenter que des pages inclinées de 0-30° ou 60-90°,
 * et son score était dominé par l'aire du quadrilatère plutôt que par la preuve
 * d'arête. Le redressement est désormais EXPLICITE, piloté par l'utilisateur,
 * et la qualité d'image est conservée à la résolution de la photo.
 *
 * Chaîne : capture -> normalisation bornée -> coins -> redressement
 * homographique 1:1 -> noir et blanc local (Sauvola) -> encodage JPEG.
 */

export type ScanCorner = { x: number; y: number };

export type PreparedScanSource = {
  /** URI originale stable, a reutiliser si les coins sont corriges. */
  originalUri: string;
  /** URI de la photo normalisee, alignee sur sourceWidth/sourceHeight. */
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
};

export type ProcessedScanPage = {
  /** URI originale stable, à réutiliser si les coins sont corrigés. */
  originalUri: string;
  /** URI de la photo normalisée, alignée sur sourceWidth/sourceHeight. */
  sourceUri: string;
  /** URI locale de la page redressée et améliorée. */
  processedUri: string;
  /** JPEG corrigé, prêt pour PocketBase et l'OCR. */
  base64: string;
  width: number;
  height: number;
  /** Dimensions de la photo normalisée, utilisées par l'éditeur de coins. */
  sourceWidth: number;
  sourceHeight: number;
  /** Coins normalisés (0..1), dans l'ordre haut-gauche, haut-droit, bas-droit, bas-gauche. */
  corners: ScanCorner[];
  autoDetected: boolean;
};

type JpegImage = {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
};

type JpegModule = {
  decode: (
    data: Uint8Array | Buffer,
    options: {
      useTArray: true;
      formatAsRGBA: true;
      maxResolutionInMP?: number;
      maxMemoryUsageInMB?: number;
    },
  ) => JpegImage;
  encode: (data: JpegImage, quality?: number) => { data: Uint8Array | Buffer; width: number; height: number };
};

type NormalizedJpeg = { bytes: Uint8Array; uri: string; width: number; height: number };

/**
 * Côté long maximal de la PHOTO complète avant décodage. 2048 px sur un A4
 * ≈ 240 DPI, au-dessus du standard d'impression 200 DPI et très au-delà des
 * besoins OCR (1500 px ≈ 180 DPI). Le décodage jpeg-js est ~4x plus rapide
 * qu'à 4096 px (mesuré : 84s → ~20s sur 7.5 MP).
 */
const MAX_SOURCE_EDGE = 2048;

/**
 * Côté long maximal de la page redressée. 3000 px sur un A4 ≈ 360 DPI, soit
 * largement au-delà de toute résolution d'impression bureautique, tout en
 * gardant des tableaux de travail tenables sur mobile.
 */
const MAX_OUTPUT_EDGE = 3000;

/**
 * Budget mémoire de jpeg-js. Ses valeurs par défaut (100 MP / 512 Mo) sont trop
 * serrées pour une photo 12 MP décodée en RGBA.
 */
const DECODE_MAX_MP = 24;
const DECODE_MAX_MEMORY_MB = 1024;

/** Binarisation locale : fenêtre, gain, et largeur de la zone de transition. */
const BIN_WINDOW_RADIUS = 12;
const BIN_K = 0.2;
const BIN_DYNAMIC_RANGE = 128;
/** Le seuil doit rester dans [plancher, 255 - plancher] pour ne pas noircir le papier. */
const BIN_THRESHOLD_FLOOR = 12;
/** Largeur de la transition, en fraction de l'écart-type local. */
const BIN_BAND_SIGMA = 0.5;
/** Plancher absolu de la bande, pour que les zones plates ne deviennent pas des marches. */
const BIN_BAND_MIN = 9;
/** Hauteur de bande du traitement : borne la mémoire des tableaux de travail. */
const BIN_BAND_ROWS = 512;

const FINAL_JPEG_QUALITY = 92;

/**
 * Mesure des etapes, pour identifier le temps reel sur appareil.
 *
 * Hermes interprete le JavaScript : jpeg-js y est environ 15x plus lent que sur
 * un PC, donc un chronometreExecute sur la machine de developpement NE PREVOIT
 * PAS la duree reelle. Seul un log execute sur l'appareil fait foi.
 *
 * Passe a `true` pourinstrumenter, puis REMETTRE A `false` avant de commiter :
 * le traceur doit rester disponible, mais par defaut.
 */
const TRACE_SCAN_STEPS = true;

export type ScanTraceEntry = { step: string; ms: number; detail?: string };

let scanTrace: ScanTraceEntry[] = [];

/**
 * Abonnes au journal des etapes. L'ecran de scan s'y inscrit pour afficher
 * les temps directement dans l'interface : sur un telephone physique, rien
 * n'apparait a l'ecran, donc un console.log seul est invisible pour l'utilisateur.
 */
const traceListeners = new Set<(entries: ScanTraceEntry[]) => void>();

const notifyTrace = () => {
  const snapshot = [...scanTrace];
  traceListeners.forEach((listener) => listener(snapshot));
};

export const subscribeScanTrace = (listener: (entries: ScanTraceEntry[]) => void): (() => void) => {
  traceListeners.add(listener);
  listener([...scanTrace]);
  return () => {
    traceListeners.delete(listener);
  };
};

const now = (): number =>
  (typeof globalThis !== 'undefined' && typeof (globalThis as any).performance?.now === 'function')
    ? (globalThis as any).performance.now()
    : Date.now();

/** Enregistre une etape et la publie dans la console Metro/ADB. */
const trace = (step: string, startedAt: number, detail?: string) => {
  if (!TRACE_SCAN_STEPS) return;
  const ms = Math.round(now() - startedAt);
  const entry = { step, ms, ...(detail ? { detail } : {}) };
  scanTrace.push(entry);
  // eslint-disable-next-line no-console
  console.log(`[SCAN-TRACE] ${step.padEnd(34)} ${String(ms).padStart(6)} ms${detail ? '  ' + detail : ''}`);
  notifyTrace();
};

/** Vide le journal des etapes et affiche le total. A appeler au depart. */
export const resetScanTrace = (): void => {
  scanTrace = [];
  notifyTrace();
  if (!TRACE_SCAN_STEPS) return;
  // eslint-disable-next-line no-console
  console.log('[SCAN-TRACE] ---------- journal vidé, début d\'un scan ----------');
};

/** Journal des etapes + total, pour lecture immediate dans la console. */
export const readScanTrace = (): { entries: ScanTraceEntry[]; totalMs: number } => {
  const totalMs = scanTrace.reduce((sum, entry) => sum + entry.ms, 0);
  return { entries: [...scanTrace], totalMs };
};

/**
 * Qualité de la copie OCR : volontairement plus basse que la page stockée.
 * L'OCR ne lit que le texte, et une compression à 85 reste très au-dessus du
 * seuil où un caractère devient ambigu.
 */
const OCR_JPEG_QUALITY = 85;

let cachedJpeg: JpegModule | null = null;

function getJpegModule(): JpegModule {
  if (cachedJpeg) return cachedJpeg;

  // jpeg-js est du JavaScript pur, mais son encodeur historique attend les
  // globales Buffer et btoa. Le polyfill buffer est déjà dans le projet.
  const runtime = globalThis as any;
  if (!runtime.Buffer) runtime.Buffer = Buffer;
  if (typeof runtime.btoa !== 'function') {
    runtime.btoa = (value: string) => Buffer.from(value, 'binary').toString('base64');
  }
  cachedJpeg = require('jpeg-js') as JpegModule;
  return cachedJpeg;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Coins par défaut = cadre entier. Aucun redressement automatique n'est appliqué :
 * l'utilisateur part d'une page non recadrée et ajuste ce qu'il veut.
 */
const DEFAULT_CORNERS: ScanCorner[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function normalizeCorner(corner: ScanCorner): ScanCorner {
  return { x: clamp(corner.x, 0, 1), y: clamp(corner.y, 0, 1) };
}

function normalizeCorners(corners: ScanCorner[]): ScanCorner[] {
  if (corners.length !== 4) throw new Error('Les quatre coins du document sont requis.');
  return corners.map((corner) => ({ x: corner.x, y: corner.y }));
}

function distance(a: ScanCorner, b: ScanCorner): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function signedPolygonArea(points: ScanCorner[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function polygonArea(points: ScanCorner[]): number {
  return Math.abs(signedPolygonArea(points));
}

function cross(a: ScanCorner, b: ScanCorner, c: ScanCorner): number {
  return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
}

function isValidQuad(corners: ScanCorner[]): boolean {
  if (corners.length !== 4 || corners.some((corner) =>
    !Number.isFinite(corner.x) || !Number.isFinite(corner.y),
  )) return false;
  if (corners.some((corner) => corner.x < 0 || corner.x > 1 || corner.y < 0 || corner.y > 1)) return false;
  if (polygonArea(corners) < 0.01) return false;
  const sides = [0, 1, 2, 3].map((index) => distance(corners[index], corners[(index + 1) % 4]));
  if (Math.min(...sides) < 0.025) return false;
  const crosses = [0, 1, 2, 3].map((index) => cross(corners[index], corners[(index + 1) % 4], corners[(index + 2) % 4]));
  return crosses.every((value) => value > 0.000001) || crosses.every((value) => value < -0.000001);
}

function validateCorners(corners: ScanCorner[]): ScanCorner[] {
  const normalized = normalizeCorners(corners);
  if (!isValidQuad(normalized)) {
    throw new Error('Les coins du document sont trop proches ou forment une forme invalide. Réessayez de les placer sur les quatre bords.');
  }
  return normalized;
}

/**
 * Ordonne quatre intersections en haut-gauche, haut-droit, bas-droit, bas-gauche.
 * Les sommes/différences sont plus stables que le seul angle autour du centre
 * pour un quadrilatère en losange ou fortement incliné.
 */
function orderCorners(points: ScanCorner[]): ScanCorner[] {
  if (points.length !== 4) return [];
  const centerX = points.reduce((sum, point) => sum + point.x, 0) / 4;
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / 4;
  const cyclic = [...points].sort((a, b) => {
    const angleA = Math.atan2(a.y - centerY, a.x - centerX);
    const angleB = Math.atan2(b.y - centerY, b.x - centerX);
    return angleA - angleB;
  });
  let start = 0;
  for (let index = 1; index < cyclic.length; index += 1) {
    const candidate = cyclic[index];
    const current = cyclic[start];
    if (candidate.y < current.y - 0.0001 || (Math.abs(candidate.y - current.y) <= 0.0001 && candidate.x < current.x)) {
      start = index;
    }
  }
  return Array.from({ length: 4 }, (_, offset) => {
    const point = cyclic[(start + offset) % 4];
    return { x: point.x, y: point.y };
  });
}

function solveLinear(matrix: number[][], values: number[]): number[] | null {
  const size = values.length;
  const augmented = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 0.0000001) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let item = column; item <= size; item += 1) augmented[column][item] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let item = column; item <= size; item += 1) augmented[row][item] -= factor * augmented[column][item];
    }
  }
  return augmented.map((row) => row[size]);
}

function homographyForQuad(corners: ScanCorner[], width: number, height: number): number[] | null {
  const destination: ScanCorner[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const matrix: number[][] = [];
  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const x = destination[index].x;
    const y = destination[index].y;
    const u = corners[index].x;
    const v = corners[index].y;
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  const result = solveLinear(matrix, values);
  return result ? [...result, 1] : null;
}

/**
 * Redressement en perspective, échantillonnage bilineaire, à l'échelle 1:1.
 *
 * La sortie garde la taille réelle du quadrilatère source : aucun détail n'est
 * inventé ni perdu. MAX_OUTPUT_EDGE ne réduit que les redressements vraiment
 * trop grands (gros papier, ou capture qui dépasse les limites de l'image).
 */
function transformPerspective(
  rgba: Uint8Array,
  sourceWidth: number,
  sourceHeight: number,
  normalizedCorners: ScanCorner[],
): { data: Uint8Array; width: number; height: number } {
  const corners = validateCorners(normalizedCorners).map((corner) => ({
    x: corner.x * sourceWidth,
    y: corner.y * sourceHeight,
  }));
  const top = distance(corners[0], corners[1]);
  const bottom = distance(corners[3], corners[2]);
  const left = distance(corners[0], corners[3]);
  const right = distance(corners[1], corners[2]);
  let outputWidth = Math.max(1, Math.round(Math.max(top, bottom)));
  let outputHeight = Math.max(1, Math.round(Math.max(left, right)));
  const longest = Math.max(outputWidth, outputHeight);
  if (longest > MAX_OUTPUT_EDGE) {
    const scale = MAX_OUTPUT_EDGE / longest;
    outputWidth = Math.max(1, Math.round(outputWidth * scale));
    outputHeight = Math.max(1, Math.round(outputHeight * scale));
  }
  const homography = homographyForQuad(corners, outputWidth, outputHeight);
  if (!homography || homography.some((value) => !Number.isFinite(value))) {
    throw new Error('Le redressement a échoué : la forme sélectionnée est invalide. Corrigez les coins manuellement.');
  }

  const output = new Uint8Array(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const outputIndex = (y * outputWidth + x) * 4;
      const denominator = homography[6] * x + homography[7] * y + homography[8];
      if (!Number.isFinite(denominator) || Math.abs(denominator) < 0.0000001) {
        output[outputIndex] = 255;
        output[outputIndex + 1] = 255;
        output[outputIndex + 2] = 255;
        output[outputIndex + 3] = 255;
        continue;
      }
      const sourceX = (homography[0] * x + homography[1] * y + homography[2]) / denominator;
      const sourceY = (homography[3] * x + homography[4] * y + homography[5]) / denominator;

      if (sourceX < 0 || sourceY < 0 || sourceX > sourceWidth - 1 || sourceY > sourceHeight - 1) {
        output[outputIndex] = 255;
        output[outputIndex + 1] = 255;
        output[outputIndex + 2] = 255;
        output[outputIndex + 3] = 255;
        continue;
      }

      const x0 = Math.floor(sourceX);
      const y0 = Math.floor(sourceY);
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const y1 = Math.min(sourceHeight - 1, y0 + 1);
      const fx = sourceX - x0;
      const fy = sourceY - y0;
      const i00 = (y0 * sourceWidth + x0) * 4;
      const i10 = (y0 * sourceWidth + x1) * 4;
      const i01 = (y1 * sourceWidth + x0) * 4;
      const i11 = (y1 * sourceWidth + x1) * 4;
      const weight00 = (1 - fx) * (1 - fy);
      const weight10 = fx * (1 - fy);
      const weight01 = (1 - fx) * fy;
      const weight11 = fx * fy;
      for (let channel = 0; channel < 3; channel += 1) {
        output[outputIndex + channel] = Math.round(
          rgba[i00 + channel] * weight00 +
            rgba[i10 + channel] * weight10 +
            rgba[i01 + channel] * weight01 +
            rgba[i11 + channel] * weight11,
        );
      }
      output[outputIndex + 3] = 255;
    }
  }
  return { data: output, width: outputWidth, height: outputHeight };
}

/**
 * Noir et blanc « net et propre » SANS perdre le liseré des caractères.
 *
 * L'ancien code appliquait un offset et un contraste GLOBAUX : un seul seuil
 * pour toute l'image (donc l'ombre d'un coin ne pouvait pas être corrigée), et un
 * écrêtage qui transformait le dégradé d'un caractère en marche dure.
 *
 * Ici : seuil local de Sauvola (mean * (1 + k*(std/R - 1))), tolérant à
 * l'éclairage irrégulier, puis une courbe en S douce centrée sur ce seuil. Le
 * corps du texte et du papier deviennent noir et blanc purs, mais la bande de
 * transition conserve l'antialiasing d'origine - des contours plus fidèles que
 * la photo de l'appareil, et non plus durs.
 *
 * Traitement par bandes de lignes : la mémoire de travail reste proportionnelle
 * à la largeur et à la bande, pas à la hauteur totale. Indispensable sur un
 * téléphone, où une page 12 MP tient ~45 Mo de luminance.
 *
 * La luminance n'est PAS précalculée dans deux Float32Array pleine image : elle
 * est calculée à la volée dans la passe horizontale, arrondie en float32
 * (Math.fround) pour reproduire exactement l'écriture dans un Float32Array. Les
 * deux tableaux pleine image coûtaient 51,5 Mo sur une page 6,8 MP sans changer
 * un seul pixel — mesuré, pas estimé.
 */
function renderBlackAndWhite(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const radius = Math.max(1, Math.min(BIN_WINDOW_RADIUS, Math.floor(Math.min(width, height) / 2)));
  const span = radius * 2 + 1;
  const invSpan = 1 / span;

  // Les deux moments sont necessaires : le seuil de Sauvola se sert de l'ecart
  // type local, donc moyenne ET moyenne des carrees, calculees sur la MEME
  // fenetre rectangulaire. Math.fround est indispensable : sans lui la somme
  // glissante derive en float64 et le rendu differe d'un ou deux niveaux.
  const lumAt = (rowBase: number, column: number): number => {
    const index = (rowBase + column) * 4;
    return Math.fround(
      0.2126 * rgba[index] + 0.7152 * rgba[index + 1] + 0.0722 * rgba[index + 2],
    );
  };

  const output = new Uint8Array(rgba.length);
  for (let y0 = 0; y0 < height; y0 += BIN_BAND_ROWS) {
    const y1 = Math.min(height, y0 + BIN_BAND_ROWS);
    // Halo : lignes necessaires aux fenetres de la bande, bornees a l'image.
    const r0 = Math.max(0, y0 - radius);
    const r1 = Math.min(height, y1 + radius);
    const rows = r1 - r0;

    // Passe horizontale sur la bande+halo, bornes gauche/droite replicates.
    const horizontal = new Float32Array(rows * width);
    const horizontalSquare = new Float32Array(rows * width);
    for (let row = 0; row < rows; row += 1) {
      const source = (r0 + row) * width;
      const target = row * width;
      let sum = 0;
      let sumSquare = 0;
      for (let offset = -radius; offset <= radius; offset += 1) {
        const value = lumAt(source, clamp(offset, 0, width - 1));
        sum += value;
        sumSquare += value * value;
      }
      for (let x = 0; x < width; x += 1) {
        horizontal[target + x] = sum * invSpan;
        horizontalSquare[target + x] = sumSquare * invSpan;
        const entering = lumAt(source, clamp(x + radius + 1, 0, width - 1));
        const leaving = lumAt(source, clamp(x - radius, 0, width - 1));
        sum += entering - leaving;
        sumSquare += entering * entering - leaving * leaving;
      }
    }

    // Passe verticale par sommes glissantes. Les valeurs horizontales sont
    // DEJA des moyennes de ligne : on re-divise donc par la seule hauteur de
    // fenetre (span), pas par span*span.
    const bandRows = y1 - y0;
    const mean = new Float32Array(bandRows * width);
    const meanSquare = new Float32Array(bandRows * width);
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let sumSquare = 0;
      // Fenetre initiale centree sur y0, bords replicates.
      for (let offset = -radius; offset <= radius; offset += 1) {
        const row = (clamp(y0 + offset, r0, r1 - 1) - r0) * width + x;
        sum += horizontal[row];
        sumSquare += horizontalSquare[row];
      }
      for (let y = y0; y < y1; y += 1) {
        const slot = (y - y0) * width + x;
        mean[slot] = sum * invSpan;
        meanSquare[slot] = sumSquare * invSpan;
        if (y + 1 < y1) {
          // Descendre d'une ligne : SORT la ligne y-radius, ENTRE y+radius+1.
          const leaving = (clamp(y - radius, r0, r1 - 1) - r0) * width + x;
          const entering = (clamp(y + radius + 1, r0, r1 - 1) - r0) * width + x;
          sum += horizontal[entering] - horizontal[leaving];
          sumSquare += horizontalSquare[entering] - horizontalSquare[leaving];
        }
      }
    }

    for (let y = y0; y < y1; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const slot = (y - y0) * width + x;
        const localMean = mean[slot];
        const localStd = Math.sqrt(Math.max(0, meanSquare[slot] - localMean * localMean));
        let threshold = localMean * (1 + BIN_K * (localStd / BIN_DYNAMIC_RANGE - 1));
        if (threshold < BIN_THRESHOLD_FLOOR) threshold = BIN_THRESHOLD_FLOOR;
        if (threshold > 255 - BIN_THRESHOLD_FLOOR) threshold = 255 - BIN_THRESHOLD_FLOOR;

        const band = Math.max(BIN_BAND_MIN, localStd * BIN_BAND_SIGMA);
        const index = (y * width + x) * 4;
        const value = 0.2126 * rgba[index] + 0.7152 * rgba[index + 1] + 0.0722 * rgba[index + 2];

        // t = 0 -> noir, t = 1 -> blanc, transition lisse sur la bande
        const t = clamp((value - threshold + band) / (2 * band), 0, 1);
        const shaded = t * t * (3 - 2 * t);
        const rounded = Math.round(shaded * 255);

        output[index] = rounded;
        output[index + 1] = rounded;
        output[index + 2] = rounded;
        output[index + 3] = 255;
      }
    }
  }
  return output;
}

function getImageDimensions(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

function resizeActionsFor(width: number, height: number): { resize: { width: number; height: number } }[] {
  const maxEdge = Math.max(width, height);
  if (maxEdge <= MAX_SOURCE_EDGE) return [];
  const scale = MAX_SOURCE_EDGE / maxEdge;
  return [{
    resize: {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    },
  }];
}

async function normalizeToJpeg(uri: string): Promise<NormalizedJpeg> {
  const startedAt = now();
  let actions: { resize: { width: number; height: number } }[] = [];
  let width = 0;
  let height = 0;
  try {
    const dimensions = await getImageDimensions(uri);
    width = dimensions.width;
    height = dimensions.height;
    actions = resizeActionsFor(width, height);
  } catch {
    // If la taille ne peut pas être lue, le décodeur garde une limite stricte
    // et échoue proprement plutôt que de tenter un buffer JavaStation énorme.
  }

  trace('normalize (avant manipulation)', startedAt,
    actions.length === 0 ? 'AUCUN redimensionnement' : `redim ${actions[0].resize.width}x${actions[0].resize.height}`);

  const manipulateStartedAt = now();
  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  trace('  manipulateAsync (natif)', manipulateStartedAt, result.uri ? '' : 'uri vide');

  if (!result.base64) throw new Error("La normalisation de l'image a échoué.");
  trace('  decodage base64 -> octets', manipulateStartedAt,
    `${(result.base64.length / 1048576).toFixed(1)} Mo de chaine base64`);
  return {
    bytes: new Uint8Array(Buffer.from(result.base64, 'base64')),
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}

/**
 * Etape 1, leger : normalise la photo et rend ses dimensions a l'editeur de
 * coins. Aucun traitement lourd ici, puisque les coins ne sont pas encore
 * connus - le redressement n'a lieu qu'une fois, a l'APPLIQUER.
 */
export async function prepareScanSource(sourceUri: string): Promise<PreparedScanSource> {
  const normalized = await normalizeToJpeg(sourceUri);
  return {
    originalUri: sourceUri,
    sourceUri: normalized.uri,
    sourceWidth: normalized.width,
    sourceHeight: normalized.height,
  };
}

/**
 * Etape 2, complete : normalise, redresse avec les coins donnes, puis rend un
 * noir et blanc net. Sans `requestedCorners`, le cadre entier est conserve.
 */
export async function processDocumentCapture(
  sourceUri: string,
  requestedCorners?: ScanCorner[],
): Promise<ProcessedScanPage> {
  const prepared = await prepareScanSource(sourceUri);
  return finalizeScanPage(prepared, requestedCorners);
}

export async function finalizeScanPage(
  prepared: PreparedScanSource,
  requestedCorners?: ScanCorner[],
): Promise<ProcessedScanPage> {
  const totalStartedAt = now();
  // prepared.sourceUri est DEJA un JPEG normalise par prepareScanSource.
  // On le re-normalise via manipulateAsync (rapide : ~1.5s) plutôt que de le
  // lire avec FileSystem.readAsStringAsync (lent : ~10.7s sur 4.5 Mo).
  // Le redimensionnement est déjà fait, donc manipulateAsync ne fait que
  // recompresser légèrement — la qualité est préservée.
  const normalized = await normalizeToJpeg(prepared.sourceUri);
  const decodeStartedAt = now();
  const decoded = getJpegModule().decode(normalized.bytes, {
    useTArray: true,
    formatAsRGBA: true,
    maxResolutionInMP: DECODE_MAX_MP,
    maxMemoryUsageInMB: DECODE_MAX_MEMORY_MB,
  });
  trace('decode JPEG (jpeg-js, JS PUR)', decodeStartedAt,
    `${decoded.width}x${decoded.height} = ${(decoded.width * decoded.height / 1e6).toFixed(1)} MP`);
  const source = decoded.data instanceof Uint8Array ? decoded.data : new Uint8Array(decoded.data as ArrayBuffer);
  // Ordre canonique applique UNE fois, au moment du traitement.
  const corners = orderCorners(validateCorners(requestedCorners || DEFAULT_CORNERS.map((corner) => ({ ...corner }))));
  const rectifyStartedAt = now();
  const transformed = transformPerspective(source, decoded.width, decoded.height, corners);
  trace('redressement perspective', rectifyStartedAt,
    `${decoded.width}x${decoded.height} -> ${transformed.width}x${transformed.height}`);
  const bwStartedAt = now();
  const rendered = renderBlackAndWhite(transformed.data, transformed.width, transformed.height);
  trace('noir et blanc Sauvola', bwStartedAt, `${transformed.width}x${transformed.height}`);
  const encodeStartedAt = now();
  const encoded = getJpegModule().encode(
    { width: transformed.width, height: transformed.height, data: rendered },
    FINAL_JPEG_QUALITY,
  );
  trace('encode JPEG final', encodeStartedAt,
    `${(encoded.data.length / 1048576).toFixed(2)} Mo`);
  const base64 = Buffer.from(encoded.data as any).toString('base64');
  const cacheDirectory = FileSystem.cacheDirectory;
  if (!cacheDirectory) throw new Error('Le cache image est inaccessible.');
  const processedUri = `${cacheDirectory}scan_${Date.now()}_${Math.round(Math.random() * 100000)}.jpg`;
  await FileSystem.writeAsStringAsync(processedUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  trace('TOTAL finalizeScanPage', totalStartedAt, `${processedUri.split('/').pop()}`);
  return {
    originalUri: prepared.originalUri,
    sourceUri: normalized.uri,
    processedUri,
    base64,
    width: transformed.width,
    height: transformed.height,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    corners,
    autoDetected: false,
  };
}

export function cornersToPixels(corners: ScanCorner[], width: number, height: number): ScanCorner[] {
  return normalizeCorners(corners).map((corner) => ({ x: corner.x * width, y: corner.y * height }));
}

/**
 * Côté long de la copie envoyée à l'OCR. L'extraction de texte ne tire aucun
 * bénéfice au-delà de ~150 ppp, alors que la page stockée vaut ~360 ppp : on
 * envoie donc une version allégée, mesurée à 1500 px de côté long.
 *
 * Gain mesuré (document 3 pages, une seule requête) : corps JSON de 2,16 Mo
 * ramené à 0,93 Mo, soit 2,3x plus léger. La page enregistrée dans PocketBase et
 * affichée dans l'app garde la pleine résolution : seule la copie OCR est
 * réduite.
 */
const OCR_MAX_EDGE = 1500;

/**
 * Réduit une page pour l'OCR, en rééchantillonnage par boîte (moyenne) puis
 * ré-encodage. Retourne le base64 d'entrée si l'image est déjà assez petite ou
 * si l'encodage échoue : mieux vaut envoyer une page trop grande que pas de
 * page du tout.
 */
export async function buildOcrBase64(page: {
  base64: string;
  width: number;
  height: number;
}): Promise<string> {
  const longest = Math.max(page.width, page.height);
  if (page.base64.length === 0 || longest <= OCR_MAX_EDGE) return page.base64;
  try {
    const bytes = new Uint8Array(Buffer.from(page.base64, 'base64'));
    const decoded = getJpegModule().decode(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: DECODE_MAX_MP,
      maxMemoryUsageInMB: DECODE_MAX_MEMORY_MB,
    });
    // Facteur entier : le rééchantillonnage boîte aligne alors exactement sur
    // la grille, sans dérive ni mélange de deux lignes.
    const factor = Math.max(1, Math.round(longest / OCR_MAX_EDGE));
    const width = Math.max(1, Math.floor(decoded.width / factor));
    const height = Math.max(1, Math.floor(decoded.height / factor));
    const source = decoded.data instanceof Uint8Array
      ? decoded.data
      : new Uint8Array(decoded.data as ArrayBuffer);
    const reduced = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const target = (y * width + x) * 4;
        // Moyenne du bloc factor x factor : préserve la finesse des jambages
        // là où une simple sélection aurait aliasé les caractères.
        let r = 0;
        let g = 0;
        let b = 0;
        for (let dy = 0; dy < factor; dy += 1) {
          const rowBase = (y * factor + dy) * decoded.width + x * factor;
          for (let dx = 0; dx < factor; dx += 1) {
            const index = (rowBase + dx) * 4;
            r += source[index];
            g += source[index + 1];
            b += source[index + 2];
          }
        }
        const samples = factor * factor;
        reduced[target] = Math.round(r / samples);
        reduced[target + 1] = Math.round(g / samples);
        reduced[target + 2] = Math.round(b / samples);
        reduced[target + 3] = 255;
      }
    }
    const encoded = getJpegModule().encode(
      { width, height, data: reduced },
      OCR_JPEG_QUALITY,
    );
    return Buffer.from(encoded.data as any).toString('base64');
  } catch {
    // Réduction impossible : la page pleine résolution part telle quelle.
    return page.base64;
  }
}

export function defaultScanCorners(): ScanCorner[] {
  return DEFAULT_CORNERS.map((corner) => ({ ...corner }));
}