import { createFileRoute } from "@tanstack/react-router";
import { useGSAP } from "@gsap/react";
import {
  FrameIcon,
  LockClosedIcon,
  RocketIcon,
  DownloadIcon,
  MagicWandIcon,
  CheckCircledIcon,
  HeartFilledIcon,
  GitHubLogoIcon,
} from "@radix-ui/react-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShinyBadge } from "@/components/ui/shiny-badge";
import { ImageUpload } from "@/components/watermark-remover/image-upload";
import { WatermarkSelector } from "@/components/watermark-remover/watermark-selector";
import { ProcessingStatus } from "@/components/watermark-remover/processing-status";
import { canProcess, recordUsage } from "@/lib/usage-tracker";
import { Background } from "@/sections/hero/_components/background";
import { gsap, premiumEase, registerGsapPlugins, SplitText } from "@/lib/gsap-config";
import { useLenis } from "@/lib/lenis-context";
import Footer from "@/sections/footer/footer";
import type { WorkerResponse } from "@/lib/inpainting-worker";
import InpaintingWorker from "@/lib/inpainting-worker?worker";

registerGsapPlugins();

export const Route = createFileRoute("/")({
  component: App,
});

const features = [
  {
    icon: LockClosedIcon,
    title: "100% Private",
    description: "Your images never leave your device. All processing happens locally in your browser.",
  },
  {
    icon: RocketIcon,
    title: "Lightning Fast",
    description: "Powered by WebAssembly and ONNX Runtime for near-instant processing.",
  },
  {
    icon: MagicWandIcon,
    title: "AI-Powered",
    description: "State-of-the-art LaMa model for intelligent inpainting and seamless removal.",
  },
];

function App() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [maskCanvas, setMaskCanvas] = useState<HTMLCanvasElement | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [modelProgress, setModelProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const processingResolveRef = useRef<((result: string) => void) | null>(null);
  const processingRejectRef = useRef<((error: Error) => void) | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(() => {
    if (typeof document === "undefined") return false;
    if (!("fonts" in document)) return true;
    return document.fonts.status === "loaded";
  });
  const { scrollTo } = useLenis();

  useEffect(() => {
    if (fontsLoaded || typeof document === "undefined") return;
    if (!("fonts" in document)) {
      setFontsLoaded(true);
      return;
    }

    let isActive = true;
    document.fonts.ready.then(() => {
      if (isActive) setFontsLoaded(true);
    });

    return () => {
      isActive = false;
    };
  }, [fontsLoaded]);

  useGSAP(
    (context) => {
      if (!fontsLoaded) return;

      const hero = heroRef.current;
      if (!hero) return;

      const splits: SplitText[] = [];
      context.add(() => {
        for (const split of splits) {
          split.revert();
        }
      });

      const titleSplit = titleRef.current ? new SplitText(titleRef.current, { type: "lines" }) : null;

      const descriptionSplit = descriptionRef.current ? new SplitText(descriptionRef.current, { type: "lines" }) : null;

      if (titleSplit) splits.push(titleSplit);
      if (descriptionSplit) splits.push(descriptionSplit);

      const timeline = gsap.timeline({
        defaults: { ease: premiumEase },
        scrollTrigger: {
          trigger: hero,
          start: "top 80%",
          once: true,
        },
      });

      if (badgeRef.current) {
        timeline.from(badgeRef.current, {
          yPercent: 30,
          autoAlpha: 0,
          filter: "blur(16px)",
          duration: 0.9,
          ease: premiumEase,
        });
      }

      if (titleSplit) {
        timeline.from(
          titleSplit.lines,
          {
            yPercent: 30,
            autoAlpha: 0,
            filter: "blur(16px)",
            stagger: 0.15,
            duration: 0.9,
            ease: premiumEase,
          },
          "-=0.6",
        );
      }

      if (descriptionSplit) {
        timeline.from(
          descriptionSplit.lines,
          {
            yPercent: 30,
            autoAlpha: 0,
            filter: "blur(16px)",
            stagger: 0.15,
            duration: 0.9,
            ease: premiumEase,
          },
          "-=0.6",
        );
      }

      if (actionsRef.current) {
        const buttons = Array.from(actionsRef.current.children) as HTMLElement[];
        timeline.fromTo(
          buttons,
          {
            yPercent: 30,
            autoAlpha: 0,
            filter: "blur(16px)",
            ease: premiumEase,
          },
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            clearProps: "filter",
            stagger: 0.15,
            duration: 0.9,
            ease: premiumEase,
          },
          "-=0.6",
        );
      }

      if (featuresRef.current) {
        const featureCards = Array.from(featuresRef.current.children) as HTMLElement[];
        timeline.fromTo(
          featureCards,
          {
            yPercent: 20,
            autoAlpha: 0,
            filter: "blur(8px)",
          },
          {
            yPercent: 0,
            autoAlpha: 1,
            filter: "blur(0px)",
            clearProps: "filter",
            stagger: 0.1,
            duration: 0.7,
            ease: premiumEase,
          },
          "-=0.4",
        );
      }
    },
    { scope: heroRef, dependencies: [fontsLoaded] },
  );

  const handleWorkerMessage = useCallback((event: MessageEvent<WorkerResponse>) => {
    const message = event.data;

    switch (message.type) {
      case "load-progress":
        setModelProgress(message.percent);
        break;
      case "load-complete":
        setIsLoadingModel(false);
        break;
      case "load-error":
        setError(`Failed to load model: ${message.error}`);
        setIsLoadingModel(false);
        break;
      case "process-complete": {
        const canvas = document.createElement("canvas");
        canvas.width = message.resultData.width;
        canvas.height = message.resultData.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(message.resultData, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          processingResolveRef.current?.(dataUrl);
        } else {
          processingRejectRef.current?.(new Error("Failed to create result canvas"));
        }
        break;
      }
      case "process-error":
        processingRejectRef.current?.(new Error(message.error));
        break;
    }
  }, []);

  useEffect(() => {
    const worker = new InpaintingWorker();
    workerRef.current = worker;
    worker.onmessage = handleWorkerMessage;
    worker.postMessage({ type: "load" });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [handleWorkerMessage]);

  const handleImageSelect = (file: File) => {
    setResultUrl(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setImagePreview(url);

      const img = new Image();
      img.onload = () => {
        setImageElement(img);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const handleMaskChange = (mask: HTMLCanvasElement) => {
    setMaskCanvas(mask);
  };

  const handleProcess = async () => {
    if (!imageElement || !maskCanvas) {
      setError("Please select an image and create a mask");
      return;
    }

    if (!canProcess()) {
      setError("Unable to process. Please try again.");
      return;
    }

    if (!workerRef.current || isLoadingModel) {
      setError("Model not loaded. Please wait...");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      recordUsage();

      const imageCanvas = document.createElement("canvas");
      imageCanvas.width = imageElement.width;
      imageCanvas.height = imageElement.height;
      const imageCtx = imageCanvas.getContext("2d");
      if (!imageCtx) throw new Error("Failed to create image canvas context");
      imageCtx.drawImage(imageElement, 0, 0);
      const imageData = imageCtx.getImageData(0, 0, imageElement.width, imageElement.height);

      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) throw new Error("Failed to get mask canvas context");
      const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

      const worker = workerRef.current;
      const resultDataUrl = await new Promise<string>((resolve, reject) => {
        processingResolveRef.current = resolve;
        processingRejectRef.current = reject;

        worker.postMessage({
          type: "process",
          imageData,
          maskData,
          originalWidth: imageElement.width,
          originalHeight: imageElement.height,
        });
      });

      setResultUrl(resultDataUrl);
    } catch (err) {
      setError(`Processing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
      processingResolveRef.current = null;
      processingRejectRef.current = null;
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;

    const link = document.createElement("a");
    link.href = resultUrl;
    link.download = "watermark-removed.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="mx-auto flex flex-col items-center justify-start w-full md:w-7xl md:border-x border-border divide-y divide-border/80">
      <section
        id="hero"
        ref={heroRef}
        className="relative flex min-h-[60vh] w-full px-4 md:px-16 py-16 md:py-24 flex-col items-center justify-center gap-6"
      >
        <div className="relative z-10 flex flex-col items-center gap-3 text-center max-w-4xl">
          <div ref={badgeRef} className="w-fit">
            <ShinyBadge>
              <FrameIcon aria-hidden="true" className="size-3.5" />
              100% Free • Unlimited Removals
            </ShinyBadge>
          </div>

          <h1
            ref={titleRef}
            className="text-3xl md:text-5xl text-foreground font-medium text-balance max-w-3xl leading-tight"
          >
            Remove Watermarks Instantly with AI
          </h1>

          <p
            ref={descriptionRef}
            className="text-base md:text-lg text-foreground/70 font-medium text-balance leading-relaxed max-w-2xl"
          >
            Erase watermarks and unwanted objects from your images using cutting-edge AI. Everything runs locally in
            your browser — your photos stay 100% private.
          </p>

          <div ref={actionsRef} className="flex items-center gap-3 mt-2">
            <Button variant="default" size="lg" onClick={() => scrollTo("#tool")}>
              <MagicWandIcon className="size-4" />
              Start Removing
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <a
              href="https://github.com/littlegoat-tech/removemark"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/20 text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              <GitHubLogoIcon className="size-4" />
              Open Source
            </a>
            <a
              href="https://ko-fi.com/littlegoattech"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FF5E5B]/10 hover:bg-[#FF5E5B]/20 border border-[#FF5E5B]/30 text-sm font-medium text-[#FF5E5B] transition-colors"
            >
              <HeartFilledIcon className="size-4" />
              Buy me a coffee
            </a>
          </div>
        </div>

        <div ref={featuresRef} className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 w-full max-w-4xl">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm"
            >
              <feature.icon className="size-5 text-foreground/70" />
              <span className="text-sm font-medium text-foreground">{feature.title}</span>
              <span className="text-xs text-foreground/50 text-center">{feature.description}</span>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 z-0 h-full w-full pointer-events-none">
          <Background />
        </div>
      </section>

      <section
        id="tool"
        className="w-full md:max-w-5xl md:border-x border-border/80 border-dashed divide-y divide-border/80 divide-dashed flex flex-col items-start justify-start"
      >
        <div className="w-full flex flex-col gap-2 px-4 py-8 md:p-8">
          <div className="w-fit">
            <ShinyBadge>
              <MagicWandIcon aria-hidden="true" className="size-3.5" />
              Watermark Remover
            </ShinyBadge>
          </div>
          <h2 className="text-xl md:text-2xl text-foreground font-medium text-balance leading-none">
            Upload Your Image & Remove Watermarks
          </h2>
          <p className="text-base text-foreground/70 font-medium text-balance leading-relaxed md:max-w-1/2">
            Simply upload an image, paint over the watermark area, and let our AI do the rest.
          </p>
        </div>

        <div className="relative w-full h-full p-4 md:p-8 space-y-6">
          {error && (
            <Card className="p-4 bg-destructive/10 border-destructive/30">
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}

          {isLoadingModel && (
            <Card className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Loading AI Model</p>
                    <p className="text-xs text-foreground/50">This may take a moment on first visit...</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-gradient-from to-gradient-to transition-all duration-300"
                      style={{ width: `${modelProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-foreground/50 text-right">{modelProgress}%</p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-full bg-linear-to-br from-gradient-from to-gradient-to text-primary text-sm font-medium">
                  1
                </div>
                <h3 className="text-lg font-medium text-foreground">Upload Image</h3>
              </div>
              <ImageUpload
                onImageSelect={handleImageSelect}
                preview={imagePreview}
                label="Drag and drop an image or click to select"
              />
            </Card>

            {imageElement && (
              <Card className="p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-8 rounded-full bg-linear-to-br from-gradient-from to-gradient-to text-primary text-sm font-medium">
                    2
                  </div>
                  <h3 className="text-lg font-medium text-foreground">Mark Watermark</h3>
                </div>
                <WatermarkSelector image={imageElement} onMaskChange={handleMaskChange} />
              </Card>
            )}
          </div>

          {imageElement && maskCanvas && (
            <Card className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-8 rounded-full bg-linear-to-br from-gradient-from to-gradient-to text-primary text-sm font-medium">
                    3
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">Remove Watermark</h3>
                    <p className="text-sm text-foreground/50">Click the button to process your image</p>
                  </div>
                </div>
                <Button
                  onClick={handleProcess}
                  disabled={isProcessing || isLoadingModel}
                  size="lg"
                  className="w-full md:w-auto"
                >
                  {isProcessing ? (
                    <>
                      <div className="size-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <MagicWandIcon className="size-4" />
                      Remove Watermark
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {isProcessing && (
            <Card className="p-6">
              <ProcessingStatus isLoading={true} message="Removing the watermark..." />
            </Card>
          )}

          {resultUrl && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center size-8 rounded-full bg-success/20 text-success">
                    <CheckCircledIcon className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">Result Ready</h3>
                    <p className="text-sm text-foreground/50">Your watermark-free image is ready</p>
                  </div>
                </div>
                <Button onClick={handleDownload} size="md">
                  <DownloadIcon className="size-4" />
                  Download
                </Button>
              </div>
              <div className="border border-border rounded-lg overflow-hidden">
                <img src={resultUrl} alt="Processed result" className="max-w-full h-auto" />
              </div>
            </Card>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}
