# Removemark

A free, browser-based watermark remover powered by AI. Get rid of watermarks and unwanted objects from your images instantly — everything happens right in your browser, so your photos stay completely private.

<p align="center">
  <img src="https://raw.githubusercontent.com/littlegoat-tech/removemark/main/.github/banner.png" alt="Removemark Banner" width="100%">
</p>

**[Try it live →](https://removemark.app)**

## Features

- **100% Private** — Your images never leave your device. All the AI processing happens locally in your browser using WebAssembly.
- **Lightning Fast** — Powered by ONNX Runtime Web, so processing is nearly instant after the initial model loads.
- **AI-Powered** — Uses the LaMa (Large Mask Inpainting) model to intelligently remove watermarks seamlessly.
- **Free & Unlimited** — No sign-up required, no usage limits, and no watermarks on your results.
- **Easy to Use** — Just upload an image, mark the watermark area, and download your clean result.

## How It Works

1. **Upload** — Drag and drop or click to select an image
2. **Mark** — Use quick preset masks or paint over the watermark area with the brush tool
3. **Remove** — Click the button and watch the AI work its magic
4. **Download** — Save your watermark-free image

The app uses the LaMa inpainting model, which has been converted to ONNX format so it runs efficiently in your browser. The first time you visit, the model (about 200MB) gets downloaded and cached in your browser's IndexedDB, making subsequent loads much faster.

## Technology

- **ONNX Runtime Web** — Runs the AI model directly in your browser via WebAssembly
- **LaMa Model** — A state-of-the-art image inpainting model that removes objects and reconstructs backgrounds naturally
- **React 19 + TanStack Start** — Modern React with server-side rendering
- **Web Workers** — Processing runs in a background thread to keep the UI responsive
- **IndexedDB Caching** — The model gets cached locally after the first download

## Getting Started

**Requirements:**
- Node.js 20+
- pnpm 9+

**Setup:**
1. Download the LaMa ONNX model from [Hugging Face](https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx?download=true) and place it at `public/models/lama_fp32.onnx`
2. Install dependencies and start the development server:
```bash
pnpm install
pnpm dev
```

The app will be running at `http://localhost:3013`.

## Project Structure

```
src/
 ├─ routes/              Page components
 ├─ components/
 │   ├─ watermark-remover/   Main tool components
 │   └─ ui/              UI primitives (buttons, cards, etc.)
 ├─ lib/
 │   ├─ inpainting-worker.ts   Web Worker for model inference
 │   ├─ onnx-model.ts          Model loading and caching
 │   └─ image-processing.ts    Tensor/image conversions
 └─ styles.css           Theme and global styles

public/
 ├─ models/              ONNX model file
 └─ onnxruntime-web/     WASM runtime files
```

## Scripts

```bash
pnpm dev        # Development server
pnpm build      # Production build
pnpm serve      # Preview production build
pnpm lint       # Check code with Biome
pnpm format     # Format code with Biome
```

## Browser Support

Works best in modern browsers with WebAssembly support:
- Chrome 90+
- Firefox 89+
- Safari 15+
- Edge 90+

## Privacy

Your images are never uploaded to any server. Everything happens entirely within your browser using WebAssembly. The only network requests are:
- Initial page load
- One-time model download (about 200MB, which gets cached locally)

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## Credits

### Template
Built on the [Nocta UI Portfolio Template](https://www.nocta-ui.com/) — a modern, accessible React component library with TanStack Start integration.

### AI Model
- **LaMa (Large Mask Inpainting)** — [GitHub](https://github.com/advimman/lama) | [Paper](https://arxiv.org/abs/2109.07161)
  - Original authors: Roman Suvorov, Elizaveta Logacheva, Anton Mashikhin, Anastasia Remizova, Arsenii Ashukha, Aleksei Silvestrov, Naejin Kong, Harshith Goka, Kiwoong Park, Victor Lempitsky
  - Samsung AI Center Moscow

### Runtime
- **ONNX Runtime Web** — [GitHub](https://github.com/microsoft/onnxruntime) — Microsoft's cross-platform ML inference engine

### Libraries
- [TanStack Start](https://tanstack.com/start) — Full-stack React framework
- [GSAP](https://greensock.com/gsap/) — Professional-grade animations
- [Lenis](https://github.com/darkroomengineering/lenis) — Smooth scroll library
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS framework
- [Radix Icons](https://www.radix-ui.com/icons) — Icon set

## Support

If you find this tool useful, consider [buying me a coffee](https://ko-fi.com/littlegoattech) ☕

## License

MIT
