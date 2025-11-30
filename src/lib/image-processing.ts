import * as ort from "onnxruntime-web/webgpu";

const INPUT_SIZE = 512;

export function imageToTensor(image: HTMLImageElement, size: number = INPUT_SIZE): ort.Tensor {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(image, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  const tensor = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    tensor[i] = data[i * 4] / 255.0;
    tensor[i + size * size] = data[i * 4 + 1] / 255.0;
    tensor[i + 2 * size * size] = data[i * 4 + 2] / 255.0;
  }

  return new ort.Tensor("float32", tensor, [1, 3, size, size]);
}

export function maskToTensor(mask: HTMLImageElement | HTMLCanvasElement, size: number = INPUT_SIZE): ort.Tensor {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(mask, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  const tensor = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const gray = data[i * 4];
    tensor[i] = gray > 127 ? 1.0 : 0.0;
  }

  return new ort.Tensor("float32", tensor, [1, 1, size, size]);
}

export function tensorToImage(tensor: ort.Tensor, originalWidth: number, originalHeight: number): string {
  const size = INPUT_SIZE;
  const data = tensor.data as Float32Array;
  const dims = tensor.dims;

  if (!dims || dims.length !== 4 || dims[0] !== 1 || dims[1] !== 3) {
    throw new Error(`Unexpected tensor format: ${JSON.stringify(dims)}`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  const imageData = ctx.createImageData(size, size);
  const channelSize = size * size;

  for (let i = 0; i < size * size; i++) {
    const r = Math.round(Math.max(0, Math.min(255, data[i] * 255)));
    const g = Math.round(Math.max(0, Math.min(255, data[i + channelSize] * 255)));
    const b = Math.round(Math.max(0, Math.min(255, data[i + 2 * channelSize] * 255)));

    imageData.data[i * 4] = r;
    imageData.data[i * 4 + 1] = g;
    imageData.data[i * 4 + 2] = b;
    imageData.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);

  const resultCanvas = document.createElement("canvas");
  resultCanvas.width = originalWidth;
  resultCanvas.height = originalHeight;
  const resultCtx = resultCanvas.getContext("2d");

  if (!resultCtx) {
    throw new Error("Failed to get result canvas context");
  }

  resultCtx.drawImage(canvas, 0, 0, originalWidth, originalHeight);
  return resultCanvas.toDataURL("image/png");
}
