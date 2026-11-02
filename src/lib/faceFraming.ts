/* Enquadramento automático pelo rosto: acha os rostos na foto (MediaPipe, no navegador)
   e calcula zoom/posição da foto na área do layout para a cabeça não ficar cortada. */

import type { ComposeConfig } from '@/components/media/composeConfig';

const VERSION = '0.10.14';
const BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

/** Caixa em pixels da foto original */
export type Box = { x: number; y: number; width: number; height: number };
export type FaceScan = { width: number; height: number; faces: Box[] };
export type FramingStatus = 'ok' | 'tight' | 'cut' | 'noface';

type Detector = { detect: (img: HTMLImageElement) => { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number }; categories?: { score: number }[] }[] } };

let detectorPromise: Promise<Detector> | null = null;

/** Carrega o detector uma vez (≈1 MB, do CDN), só quando alguém pede uma análise */
function getDetector(): Promise<Detector> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      // import em tempo de execução, fora do bundle do Next
      const load = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
      const vision = await load(BUNDLE_URL);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      return vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.5,
      });
    })().catch((e) => {
      detectorPromise = null; // permite tentar de novo
      throw e;
    });
  }
  return detectorPromise;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a foto'));
    img.src = url;
  });
}

// o detector é síncrono e único: uma foto por vez
let queue: Promise<unknown> = Promise.resolve();

/** Rostos encontrados na foto (em pixels da foto) */
export function scanFaces(photoUrl: string): Promise<FaceScan> {
  const run = async () => {
    const [detector, img] = await Promise.all([getDetector(), loadImage(photoUrl)]);
    const res = detector.detect(img);
    const faces = (res.detections ?? [])
      .filter((d) => (d.categories?.[0]?.score ?? 1) >= 0.5 && d.boundingBox)
      .map((d) => ({ x: d.boundingBox!.originX, y: d.boundingBox!.originY, width: d.boundingBox!.width, height: d.boundingBox!.height }));
    return { width: img.naturalWidth, height: img.naturalHeight, faces };
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

/**
 * Cabeça inteira a partir dos rostos: o detector marca do meio da testa ao queixo,
 * então sobe para incluir o cabelo e alarga um pouco. Vários rostos (irmãos) = caixa de todos.
 */
function headBox(faces: Box[]): Box | null {
  if (!faces.length) return null;
  const heads = faces.map((f) => ({
    x: f.x - f.width * 0.15,
    y: f.y - f.height * 0.55,
    width: f.width * 1.3,
    height: f.height * 1.75,
  }));
  const x1 = Math.min(...heads.map((h) => h.x));
  const y1 = Math.min(...heads.map((h) => h.y));
  const x2 = Math.max(...heads.map((h) => h.x + h.width));
  const y2 = Math.max(...heads.map((h) => h.y + h.height));
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/** Mesma conta do ComposedImage: tamanho e canto da foto dentro da área do layout */
function placement(cfg: ComposeConfig, sw: number, sh: number) {
  const pr = cfg.photoRect;
  const dw = pr.width, dh = pr.height;
  let r = ['contain', 'inside'].includes(pr.fit) ? Math.min(dw / sw, dh / sh) : Math.max(dw / sw, dh / sh);
  r *= typeof pr.scale === 'number' ? pr.scale : 1;
  const nw = sw * r, nh = sh * r;
  return { r, nw, nh, left: (dw - nw) / 2 + (pr.offsetX || 0), top: (dh - nh) / 2 + (pr.offsetY || 0), dw, dh };
}

/**
 * Situação da cabeça na composição atual. Só conta o que o enquadramento consegue mostrar:
 * se a cabeça já encosta na borda da própria foto, isso não é corte do layout.
 */
export function framingStatus(cfg: ComposeConfig, scan: FaceScan): FramingStatus {
  const raw = headBox(scan.faces);
  if (!raw) return 'noface';
  const x1 = Math.max(0, raw.x), y1 = Math.max(0, raw.y);
  const x2 = Math.min(scan.width, raw.x + raw.width), y2 = Math.min(scan.height, raw.y + raw.height);
  const p = placement(cfg, scan.width, scan.height);
  const top = p.top + y1 * p.r;
  const left = p.left + x1 * p.r;
  const right = p.left + x2 * p.r;
  const bottom = p.top + y2 * p.r;
  const tol = p.dh * 0.01;
  if (top < -tol || left < -tol || right > p.dw + tol || bottom > p.dh + tol) return 'cut';
  // no limite: cabeça colada no alto da área, com parte da foto escondida acima dela
  if (top < p.dh * 0.03 && p.top < -tol) return 'tight';
  return 'ok';
}

/**
 * Zoom e posição para a cabeça ficar inteira no terço de cima da área da foto, sem deixar
 * sobra vazia (a foto continua cobrindo a área). Devolve a composição com o novo photoRect.
 */
export function autoFrame(cfg: ComposeConfig, scan: FaceScan): ComposeConfig | null {
  const head = headBox(scan.faces);
  if (!head) return null;
  const pr = cfg.photoRect;
  const dw = pr.width, dh = pr.height;
  const sw = scan.width, sh = scan.height;
  const cover = Math.max(dw / sw, dh / sh);

  // zoom: só aproxima quando a cabeça fica pequena demais; nunca afasta além do "cover"
  const headH = head.height * cover;
  let scale = 1;
  if (headH < dh * 0.2) scale = Math.min(1.8, (dh * 0.28) / headH);
  const r = cover * scale;
  const nw = sw * r, nh = sh * r;

  // cabeça centralizada na horizontal e com o centro a ~36% da altura (ou mais baixo se for grande)
  const hw = head.width * r, hh = head.height * r;
  const wantCx = dw / 2;
  const wantCy = Math.max(dh * 0.36, hh / 2 + dh * 0.06);
  let left = wantCx - (head.x * r + hw / 2);
  let top = wantCy - (head.y * r + hh / 2);
  // a foto precisa continuar cobrindo a área inteira
  left = Math.min(0, Math.max(dw - nw, left));
  top = Math.min(0, Math.max(dh - nh, top));

  return {
    ...cfg,
    photoRect: {
      ...pr,
      fit: 'cover',
      scale: Math.round(scale * 1000) / 1000,
      offsetX: Math.round(left - (dw - nw) / 2),
      offsetY: Math.round(top - (dh - nh) / 2),
    },
  };
}

export const FRAMING_LABEL: Record<FramingStatus, string> = {
  ok: 'Rosto inteiro',
  tight: 'Cabeça no limite',
  cut: 'Cabeça cortada',
  noface: 'Rosto não encontrado',
};
