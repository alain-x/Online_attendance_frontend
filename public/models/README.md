# Face-api.js models (AI face detection)

For AI face detection and recognition, copy the model files here.

1. Download the weights from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights  
2. Copy these files into this folder (`public/models/`):
   - `ssd_mobilenetv1_model-weights_manifest.json` and shards
   - `face_landmark_68_model-weights_manifest.json` and shards  
   - `face_recognition_model-weights_manifest.json` and shards

Or run (from repo root):
```bash
cd public/models && curl -LO https://github.com/justadudewhohacks/face-api.js/raw/master/weights/ssd_mobilenetv1_model-weights_manifest.json
# ... (download remaining files)
```

If models are missing, the app still works but skips AI face detection (any image is accepted).
