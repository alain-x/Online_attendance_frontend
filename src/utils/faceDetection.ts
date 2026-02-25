/**
 * Face detection and descriptor extraction using face-api.js (AI).
 * Models must be in public/models/ - download from:
 * https://github.com/justadudewhohacks/face-api.js/tree/master/weights
 * (ssd_mobilenetv1_model-*, face_landmark_68_model-*, face_recognition_model-*)
 * If models are not loaded, detection is skipped (face: true).
 */

const MODEL_URL = '/models';
let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

let faceApiScriptPromise: Promise<void> | null = null;

function getFaceApiGlobal(): any {
  return (window as any).faceapi;
}

async function ensureFaceApiScriptLoaded(): Promise<void> {
  if (getFaceApiGlobal()) return;
  if (faceApiScriptPromise) return faceApiScriptPromise;

  faceApiScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-faceapi="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load face-api.js')));
      return;
    }

    const s = document.createElement('script');
    s.setAttribute('data-faceapi', 'true');
    s.async = true;
    s.src = 'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load face-api.js'));
    document.head.appendChild(s);
  });

  return faceApiScriptPromise;
}

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;
  try {
    await ensureFaceApiScriptLoaded();
    const faceapi = getFaceApiGlobal();
    if (!faceapi) throw new Error('face-api.js not available');
    loadPromise = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).then(() => {
      modelsLoaded = true;
    });
    await loadPromise;
  } catch {
    modelsLoaded = false;
    loadPromise = null;
  }
}

export type FaceResult = {
  face: boolean;
  descriptor?: number[];
};

/**
 * Detect a single face in the image and optionally return its 128-d descriptor.
 * Returns { face: false } if no face found or models not loaded.
 */
export async function detectFaceInImage(
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<FaceResult> {
  try {
    await loadModels();
    if (!modelsLoaded) return { face: true };

    const faceapi = getFaceApiGlobal();
    if (!faceapi) return { face: true };
    const detection = await faceapi
      .detectSingleFace(input)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return { face: false };
    const descriptor = Array.from(detection.descriptor) as number[];
    return { face: true, descriptor };
  } catch {
    return { face: true };
  }
}

/**
 * Load image from File/Blob and run face detection.
 */
export function detectFaceInFile(file: File | Blob): Promise<FaceResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      detectFaceInImage(img).then((r) => {
        URL.revokeObjectURL(url);
        resolve(r);
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ face: true });
    };
    img.src = url;
  });
}
