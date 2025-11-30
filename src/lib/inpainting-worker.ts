import * as ort from "onnxruntime-web/webgpu";

const isDev = import.meta.env.DEV;
if (isDev) {
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/";
} else {
  ort.env.wasm.wasmPaths = "/onnxruntime-web/";
}

const MODEL_URL = "/models/lama_fp32.onnx";
const MODEL_CACHE_KEY = "lama_fp32_model";
const MODEL_VERSION = "1.0";
const INPUT_SIZE = 512;

let session: ort.InferenceSession | null = null;
let loadingPromise: Promise<ort.InferenceSession> | null = null;
let inputNames: readonly string[] = [];
let outputNames: readonly string[] = [];

export type WorkerMessage =
  | { type: "load" }
  | { type: "process"; imageData: ImageData; maskData: ImageData; originalWidth: number; originalHeight: number };

export type WorkerResponse =
  | { type: "load-progress"; percent: number }
  | { type: "load-complete" }
  | { type: "load-error"; error: string }
  | { type: "process-complete"; resultData: ImageData }
  | { type: "process-error"; error: string };

async function loadModelFromCache(): Promise<ArrayBuffer | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open("watermark-remover-cache", 1);

    request.onerror = () => resolve(null);

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(["models"], "readonly");
      const store = transaction.objectStore("models");
      const getRequest = store.get(MODEL_CACHE_KEY);

      getRequest.onsuccess = () => {
        const result = getRequest.result;
        if (result?.data && result.version === MODEL_VERSION) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => resolve(null);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("models")) {
        db.createObjectStore("models");
      }
    };
  });
}

async function saveModelToCache(data: ArrayBuffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("watermark-remover-cache", 1);

    request.onerror = () => reject(new Error("Failed to open IndexedDB"));

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(["models"], "readwrite");
      const store = transaction.objectStore("models");
      const putRequest = store.put({ data, version: MODEL_VERSION }, MODEL_CACHE_KEY);

      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error("Failed to save model to cache"));
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("models")) {
        db.createObjectStore("models");
      }
    };
  });
}

async function downloadModel(onProgress: (percent: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Model file not found at ${MODEL_URL}`);
    }
    throw new Error(`Failed to fetch model: ${response.statusText}`);
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.length;

    if (total > 0) {
      onProgress(Math.round((loaded / total) * 100));
    }
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

async function loadModel(onProgress: (percent: number) => void): Promise<ort.InferenceSession> {
  if (session) return session;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      let modelData: ArrayBuffer | null = await loadModelFromCache();

      if (modelData) {
        onProgress(100);
      } else {
        modelData = await downloadModel(onProgress);
        await saveModelToCache(modelData).catch(() => {});
      }

      const options: ort.InferenceSession.SessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };

      session = await ort.InferenceSession.create(modelData, options);
      inputNames = session.inputNames;
      outputNames = session.outputNames;
      return session;
    } catch (error) {
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

async function createMaskedInputTensors(
  imageData: ImageData,
  maskData: ImageData,
  size: number = INPUT_SIZE,
): Promise<{ imageTensor: ort.Tensor; maskTensor: ort.Tensor }> {
  const imageCanvas = new OffscreenCanvas(size, size);
  const imageCtx = imageCanvas.getContext("2d");
  if (!imageCtx) throw new Error("Failed to get image canvas context");

  const maskCanvas = new OffscreenCanvas(size, size);
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) throw new Error("Failed to get mask canvas context");

  const imageBitmap = await createImageBitmap(imageData);
  const maskBitmap = await createImageBitmap(maskData);

  imageCtx.drawImage(imageBitmap, 0, 0, size, size);
  maskCtx.drawImage(maskBitmap, 0, 0, size, size);

  const scaledImageData = imageCtx.getImageData(0, 0, size, size);
  const scaledMaskData = maskCtx.getImageData(0, 0, size, size);

  const imgData = scaledImageData.data;
  const mskData = scaledMaskData.data;

  const imageTensorData = new Float32Array(3 * size * size);
  const maskTensorData = new Float32Array(size * size);

  let whiteCount = 0;
  let blackCount = 0;

  for (let i = 0; i < size * size; i++) {
    const maskVal = mskData[i * 4] > 127 ? 1.0 : 0.0;
    maskTensorData[i] = maskVal;

    if (maskVal === 1.0) {
      whiteCount++;
      imageTensorData[i] = 0;
      imageTensorData[i + size * size] = 0;
      imageTensorData[i + 2 * size * size] = 0;
    } else {
      blackCount++;
      imageTensorData[i] = imgData[i * 4] / 255.0;
      imageTensorData[i + size * size] = imgData[i * 4 + 1] / 255.0;
      imageTensorData[i + 2 * size * size] = imgData[i * 4 + 2] / 255.0;
    }
  }

  if (whiteCount === 0) {
    console.warn("[Worker] WARNING: Mask is entirely black - no area marked for inpainting!");
  }
  if (blackCount === 0) {
    console.warn("[Worker] WARNING: Mask is entirely white - entire image marked for inpainting!");
  }

  const imageTensor = new ort.Tensor("float32", imageTensorData, [1, 3, size, size]);
  const maskTensor = new ort.Tensor("float32", maskTensorData, [1, 1, size, size]);

  return { imageTensor, maskTensor };
}

function tensorToImageData(
  tensor: ort.Tensor,
  originalWidth: number,
  originalHeight: number,
  minVal: number,
  maxVal: number,
): ImageData {
  const size = INPUT_SIZE;
  const data = tensor.data as Float32Array;
  const dims = tensor.dims;

  if (!dims || dims.length !== 4 || dims[0] !== 1 || dims[1] !== 3) {
    throw new Error(`Unexpected tensor format: ${JSON.stringify(dims)}`);
  }

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Failed to get canvas context");

  const imageData = ctx.createImageData(size, size);
  const channelSize = size * size;

  const isNormalized01 = minVal >= -0.1 && maxVal <= 1.1;
  const isNormalized11 = minVal >= -1.1 && maxVal <= 1.1 && minVal < -0.1;
  const is0255 = maxVal > 1.1 && maxVal <= 255.5;

  console.log(
    "[Worker] Detected range - normalized01:",
    isNormalized01,
    "normalized11:",
    isNormalized11,
    "0-255:",
    is0255,
  );

  for (let i = 0; i < size * size; i++) {
    let r = data[i];
    let g = data[i + channelSize];
    let b = data[i + 2 * channelSize];

    if (isNormalized11) {
      r = (r + 1) / 2;
      g = (g + 1) / 2;
      b = (b + 1) / 2;
    } else if (is0255) {
      r = r / 255;
      g = g / 255;
      b = b / 255;
    }

    imageData.data[i * 4] = Math.round(Math.max(0, Math.min(255, r * 255)));
    imageData.data[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, g * 255)));
    imageData.data[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, b * 255)));
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  const resultCanvas = new OffscreenCanvas(originalWidth, originalHeight);
  const resultCtx = resultCanvas.getContext("2d");

  if (!resultCtx) throw new Error("Failed to get result canvas context");

  resultCtx.drawImage(canvas, 0, 0, originalWidth, originalHeight);
  return resultCtx.getImageData(0, 0, originalWidth, originalHeight);
}

async function processImage(
  imageData: ImageData,
  maskData: ImageData,
  originalWidth: number,
  originalHeight: number,
): Promise<ImageData> {
  if (!session) {
    throw new Error("Model not loaded");
  }

  const { imageTensor, maskTensor } = await createMaskedInputTensors(imageData, maskData);

  const imageInputName = inputNames.find((n) => n.toLowerCase().includes("image")) || inputNames[0];
  const maskInputName = inputNames.find((n) => n.toLowerCase().includes("mask")) || inputNames[1];

  const feeds: Record<string, ort.Tensor> = {
    [imageInputName]: imageTensor,
    [maskInputName]: maskTensor,
  };

  const results = await session.run(feeds);
  const outputName = outputNames[0];
  const outputTensor = results[outputName];

  console.log("[Worker] Output tensor dims:", outputTensor?.dims, "dtype:", outputTensor?.type);

  if (!outputTensor) {
    throw new Error("No output tensor received from model");
  }

  const data = outputTensor.data as Float32Array;
  const sampleValues = [data[0], data[1000], data[10000], data[100000]];
  const minVal = Math.min(...Array.from(data.slice(0, 10000)));
  const maxVal = Math.max(...Array.from(data.slice(0, 10000)));
  console.log("[Worker] Output sample values:", sampleValues, "min:", minVal, "max:", maxVal);

  return tensorToImageData(outputTensor, originalWidth, originalHeight, minVal, maxVal);
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "load": {
      try {
        await loadModel((percent) => {
          self.postMessage({ type: "load-progress", percent } as WorkerResponse);
        });
        self.postMessage({ type: "load-complete" } as WorkerResponse);
      } catch (error) {
        self.postMessage({
          type: "load-error",
          error: error instanceof Error ? error.message : "Unknown error",
        } as WorkerResponse);
      }
      break;
    }

    case "process": {
      try {
        const resultData = await processImage(
          message.imageData,
          message.maskData,
          message.originalWidth,
          message.originalHeight,
        );
        self.postMessage({ type: "process-complete", resultData } as WorkerResponse);
      } catch (error) {
        self.postMessage({
          type: "process-error",
          error: error instanceof Error ? error.message : "Unknown error",
        } as WorkerResponse);
      }
      break;
    }
  }
};
