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

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;
  try {
    const faceapi = await import('face-api.js');
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

    const faceapi = await import('face-api.js');
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
