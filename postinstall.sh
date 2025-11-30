mkdir -p public/onnxruntime-web && cp node_modules/onnxruntime-web/dist/*.wasm public/onnxruntime-web/ && cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded*.mjs public/onnxruntime-web/
mkdir -p public/models
if [ ! -f public/models/lama_fp32.onnx ]; then
  curl -L https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx?download=true -o public/models/lama_fp32.onnx
fi