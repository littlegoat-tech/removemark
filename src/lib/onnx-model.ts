import * as ort from "onnxruntime-web/webgpu";

if (typeof window !== "undefined") {
  const isDev = import.meta.env.DEV;
  if (isDev) {
    ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/";
  } else {
    ort.env.wasm.wasmPaths = "/onnxruntime-web/";
  }
}

const MODEL_URL = "/models/lama_fp32.onnx";
const MODEL_CACHE_KEY = "lama_fp32_model";
const MODEL_VERSION = "1.0";

let session: ort.InferenceSession | null = null;
let loadingPromise: Promise<ort.InferenceSession> | null = null;

export interface ModelLoadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type ProgressCallback = (progress: ModelLoadProgress) => void;

async function loadModelFromCache(): Promise<ArrayBuffer | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open("watermark-remover-cache", 1);

    request.onerror = () => {
      resolve(null);
    };

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

      getRequest.onerror = () => {
        resolve(null);
      };
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
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open("watermark-remover-cache", 1);

    request.onerror = () => {
      reject(new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = db.transaction(["models"], "readwrite");
      const store = transaction.objectStore("models");
      const putRequest = store.put({ data, version: MODEL_VERSION }, MODEL_CACHE_KEY);

      putRequest.onsuccess = () => {
        resolve();
      };

      putRequest.onerror = () => {
        reject(new Error("Failed to save model to cache"));
      };
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains("models")) {
        db.createObjectStore("models");
      }
    };
  });
}

async function downloadModel(onProgress?: ProgressCallback): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Model file not found. Please ensure ${MODEL_URL} exists in the public directory. See MODEL_SETUP.md for instructions.`,
      );
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

    if (onProgress && total > 0) {
      onProgress({
        loaded,
        total,
        percent: Math.round((loaded / total) * 100),
      });
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

export async function loadModel(onProgress?: ProgressCallback): Promise<ort.InferenceSession> {
  if (session) {
    return session;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      let modelData: ArrayBuffer | null = await loadModelFromCache();

      if (!modelData) {
        modelData = await downloadModel(onProgress);
        await saveModelToCache(modelData).catch(() => {
          console.warn("Failed to cache model");
        });
      }

      const options: ort.InferenceSession.SessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };

      session = await ort.InferenceSession.create(modelData, options);
      return session;
    } catch (error) {
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

export function getSession(): ort.InferenceSession | null {
  return session;
}
