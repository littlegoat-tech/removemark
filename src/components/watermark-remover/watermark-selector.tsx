import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "../ui/button";

interface WatermarkSelectorProps {
  image: HTMLImageElement;
  onMaskChange: (mask: HTMLCanvasElement) => void;
  initialPreset?: PresetPosition;
}

type PresetPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center" | "bottom-center";
type Tool = "brush" | "eraser";

const PRESET_MASKS: { id: PresetPosition; label: string }[] = [
  { id: "bottom-right", label: "Bottom Right" },
  { id: "bottom-left", label: "Bottom Left" },
  { id: "top-right", label: "Top Right" },
  { id: "top-left", label: "Top Left" },
  { id: "center", label: "Center" },
  { id: "bottom-center", label: "Bottom Center" },
];

interface Point {
  x: number;
  y: number;
}

export function WatermarkSelector({ image, onMaskChange, initialPreset = "bottom-right" }: WatermarkSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [brushSize, setBrushSize] = useState(80);
  const [maskSize, setMaskSize] = useState(7);
  const [activeTool, setActiveTool] = useState<Tool>("brush");
  const [maskOpacity, setMaskOpacity] = useState(50);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const onMaskChangeRef = useRef(onMaskChange);
  const isDrawingRef = useRef(false);
  const brushSizeRef = useRef(brushSize);
  const activeToolRef = useRef(activeTool);
  const maskOpacityRef = useRef(maskOpacity);
  const lastPointRef = useRef<Point | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const historyIndexRef = useRef(-1);
  const rafIdRef = useRef<number | null>(null);
  const needsRedrawRef = useRef(false);
  const isFocusedRef = useRef(false);
  const cursorRafIdRef = useRef<number | null>(null);
  const pendingCursorUpdateRef = useRef<Point | null>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const rectUpdateTimeRef = useRef(0);

  useEffect(() => {
    onMaskChangeRef.current = onMaskChange;
  }, [onMaskChange]);
  useEffect(() => {
    brushSizeRef.current = brushSize;
  }, [brushSize]);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  useEffect(() => {
    maskOpacityRef.current = maskOpacity;
  }, [maskOpacity]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    let imageCanvas = imageCanvasRef.current;
    if (!canvas || !maskCanvas) return;

    if (!imageCanvas) {
      imageCanvas = document.createElement("canvas");
      imageCanvas.width = image.width;
      imageCanvas.height = image.height;
      const imageCtx = imageCanvas.getContext("2d");
      if (imageCtx) {
        imageCtx.drawImage(image, 0, 0);
      }
      imageCanvasRef.current = imageCanvas;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageCanvas, 0, 0);

    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement("canvas");
      tempCanvasRef.current.width = maskCanvas.width;
      tempCanvasRef.current.height = maskCanvas.height;
    }
    const tempCanvas = tempCanvasRef.current;

    const tempCtx = tempCanvas.getContext("2d");
    const maskCtx = maskCanvas.getContext("2d");
    if (tempCtx && maskCtx) {
      tempCtx.globalCompositeOperation = "source-over";
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const maskData = maskImageData.data;
      const overlayImageData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const overlayData = overlayImageData.data;

      for (let i = 0; i < maskData.length; i += 4) {
        const maskValue = maskData[i];
        if (maskValue > 127) {
          overlayData[i] = 239;
          overlayData[i + 1] = 68;
          overlayData[i + 2] = 68;
          overlayData[i + 3] = Math.round((maskOpacityRef.current / 100) * 255);
        } else {
          overlayData[i + 3] = 0;
        }
      }

      tempCtx.putImageData(overlayImageData, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(tempCanvas, 0, 0);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    onMaskChangeRef.current(maskCanvas);
  }, [image]);

  const saveToHistory = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;

    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(imageData);
    if (newHistory.length > 50) newHistory.shift();

    const newIndex = Math.min(newHistory.length - 1, 49);
    historyRef.current = newHistory;
    historyIndexRef.current = newIndex;
    setHistory(newHistory);
    setHistoryIndex(newIndex);
  }, []);

  const undo = useCallback(() => {
    const currentIndex = historyIndexRef.current;
    if (currentIndex <= 0) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    const newIndex = currentIndex - 1;
    const imageData = historyRef.current[newIndex];
    if (imageData) {
      maskCtx.putImageData(imageData, 0, 0);
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      redrawCanvas();
    }
  }, [redrawCanvas]);

  const redo = useCallback(() => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;
    if (currentIndex >= currentHistory.length - 1) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    const newIndex = currentIndex + 1;
    const imageData = currentHistory[newIndex];
    if (imageData) {
      maskCtx.putImageData(imageData, 0, 0);
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      redrawCanvas();
    }
  }, [redrawCanvas]);

  const applyPresetMask = useCallback(
    (position: PresetPosition) => {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) return;

      const maskCtx = maskCanvas.getContext("2d");
      if (!maskCtx) return;

      saveToHistory();

      const width = maskCanvas.width;
      const height = maskCanvas.height;
      const currentMaskSize = maskSize;
      const maskW = width * (currentMaskSize / 100);
      const maskH = height * (currentMaskSize / 100);
      const padding = Math.min(width, height) * 0.02;

      let x = 0;
      let y = 0;

      switch (position) {
        case "bottom-right":
          x = width - maskW - padding;
          y = height - maskH - padding;
          break;
        case "bottom-left":
          x = padding;
          y = height - maskH - padding;
          break;
        case "top-right":
          x = width - maskW - padding;
          y = padding;
          break;
        case "top-left":
          x = padding;
          y = padding;
          break;
        case "center":
          x = (width - maskW) / 2;
          y = (height - maskH) / 2;
          break;
        case "bottom-center":
          x = (width - maskW) / 2;
          y = height - maskH - padding;
          break;
      }

      maskCtx.fillStyle = "white";
      maskCtx.fillRect(x, y, maskW, maskH);

      redrawCanvas();
    },
    [maskSize, redrawCanvas, saveToHistory],
  );

  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    saveToHistory();

    maskCtx.fillStyle = "black";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

    redrawCanvas();
  }, [redrawCanvas, saveToHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseEnter = () => {
      isFocusedRef.current = true;
    };
    const handleMouseLeave = () => {
      isFocusedRef.current = false;
    };
    const handleTouchStart = () => {
      isFocusedRef.current = true;
    };
    const handleTouchEnd = () => {
      setTimeout(() => {
        isFocusedRef.current = false;
      }, 100);
    };

    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchend", handleTouchEnd);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFocusedRef.current) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "[") {
        e.preventDefault();
        setBrushSize((prev) => Math.max(5, prev - 5));
      } else if (e.key === "]") {
        e.preventDefault();
        setBrushSize((prev) => Math.min(100, prev + 5));
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setActiveTool("brush");
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setActiveTool("eraser");
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo, redo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = image.width;
    canvas.height = image.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = image.width;
    imageCanvas.height = image.height;
    const imageCtx = imageCanvas.getContext("2d");
    if (imageCtx) {
      imageCtx.drawImage(image, 0, 0);
    }
    imageCanvasRef.current = imageCanvas;

    ctx.drawImage(image, 0, 0);

    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = image.width;
    maskCanvas.height = image.height;
    const maskCtx = maskCanvas.getContext("2d");
    if (!maskCtx) return;

    maskCtx.fillStyle = "black";
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCanvasRef.current = maskCanvas;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = image.width;
    tempCanvas.height = image.height;
    tempCanvasRef.current = tempCanvas;

    const initialImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

    let historyData = [initialImageData];
    let historyIdx = 0;

    if (initialPreset) {
      const width = maskCanvas.width;
      const height = maskCanvas.height;
      const initialMaskSize = 7;
      const maskW = width * (initialMaskSize / 100);
      const maskH = height * (initialMaskSize / 100);
      const padding = Math.min(width, height) * 0.02;

      let x = 0;
      let y = 0;

      switch (initialPreset) {
        case "bottom-right":
          x = width - maskW - padding;
          y = height - maskH - padding;
          break;
        case "bottom-left":
          x = padding;
          y = height - maskH - padding;
          break;
        case "top-right":
          x = width - maskW - padding;
          y = padding;
          break;
        case "top-left":
          x = padding;
          y = padding;
          break;
        case "center":
          x = (width - maskW) / 2;
          y = (height - maskH) / 2;
          break;
        case "bottom-center":
          x = (width - maskW) / 2;
          y = height - maskH - padding;
          break;
      }

      maskCtx.fillStyle = "white";
      maskCtx.fillRect(x, y, maskW, maskH);

      const presetImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      historyData = [initialImageData, presetImageData];
      historyIdx = 1;
    }

    historyRef.current = historyData;
    historyIndexRef.current = historyIdx;
    setHistory(historyData);
    setHistoryIndex(historyIdx);

    const invalidateRect = () => {
      canvasRectRef.current = null;
    };

    const getCanvasRect = (): DOMRect => {
      const now = performance.now();
      if (!canvasRectRef.current || now - rectUpdateTimeRef.current > 100) {
        canvasRectRef.current = canvas.getBoundingClientRect();
        rectUpdateTimeRef.current = now;
      }
      return canvasRectRef.current;
    };

    const handleResize = () => {
      invalidateRect();
    };

    window.addEventListener("resize", handleResize);
    const resizeObserver = new ResizeObserver(() => {
      invalidateRect();
    });
    resizeObserver.observe(canvas);

    const getCanvasCoords = (clientX: number, clientY: number): Point => {
      const rect = getCanvasRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const interpolatePoints = (p1: Point, p2: Point, size: number): Point[] => {
      const points: Point[] = [];
      const distance = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      const steps = Math.max(Math.floor(distance / (size / 4)), 1);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        points.push({
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t,
        });
      }
      return points;
    };

    const updateCursorImmediate = (point: Point) => {
      const cursor = cursorRef.current;
      if (!cursor) return;

      const rect = getCanvasRect();
      const displayX = (point.x / canvas.width) * rect.width;
      const displayY = (point.y / canvas.height) * rect.height;
      const displaySize = (brushSizeRef.current / canvas.width) * rect.width;

      const isBrush = activeToolRef.current === "brush";
      const borderColor = isBrush ? "#ef4444" : "#3b82f6";
      const bgColor = isBrush ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)";

      cursor.style.left = `${displayX}px`;
      cursor.style.top = `${displayY}px`;
      cursor.style.width = `${displaySize}px`;
      cursor.style.height = `${displaySize}px`;
      cursor.style.display = "block";
      cursor.style.borderColor = borderColor;
      cursor.style.backgroundColor = bgColor;
      cursor.style.boxShadow = `0 0 0 1px ${borderColor}40, 0 0 8px ${borderColor}20`;
    };

    const updateCursor = (point: Point) => {
      pendingCursorUpdateRef.current = point;

      if (cursorRafIdRef.current !== null) return;

      cursorRafIdRef.current = requestAnimationFrame(() => {
        cursorRafIdRef.current = null;
        if (pendingCursorUpdateRef.current) {
          updateCursorImmediate(pendingCursorUpdateRef.current);
          pendingCursorUpdateRef.current = null;
        }
      });
    };

    const hideCursor = () => {
      const cursor = cursorRef.current;
      if (cursor) cursor.style.display = "none";
    };

    const scheduleRedraw = () => {
      if (needsRedrawRef.current) return;
      needsRedrawRef.current = true;

      rafIdRef.current = requestAnimationFrame(() => {
        needsRedrawRef.current = false;

        const currentCanvas = canvasRef.current;
        const currentMaskCanvas = maskCanvasRef.current;
        const currentImageCanvas = imageCanvasRef.current;
        const currentTempCanvas = tempCanvasRef.current;
        if (!currentCanvas || !currentMaskCanvas || !currentImageCanvas || !currentTempCanvas) return;

        const currentCtx = currentCanvas.getContext("2d");
        if (!currentCtx) return;

        currentCtx.globalCompositeOperation = "source-over";
        currentCtx.globalAlpha = 1;
        currentCtx.clearRect(0, 0, currentCanvas.width, currentCanvas.height);
        currentCtx.drawImage(currentImageCanvas, 0, 0);

        const tempCtx = currentTempCanvas.getContext("2d");
        const currentMaskCtx = currentMaskCanvas.getContext("2d");
        if (tempCtx && currentMaskCtx) {
          tempCtx.globalCompositeOperation = "source-over";
          tempCtx.clearRect(0, 0, currentTempCanvas.width, currentTempCanvas.height);

          const maskImageData = currentMaskCtx.getImageData(0, 0, currentMaskCanvas.width, currentMaskCanvas.height);
          const maskData = maskImageData.data;
          const overlayImageData = tempCtx.createImageData(currentTempCanvas.width, currentTempCanvas.height);
          const overlayData = overlayImageData.data;

          for (let i = 0; i < maskData.length; i += 4) {
            const maskValue = maskData[i];
            if (maskValue > 127) {
              overlayData[i] = 239;
              overlayData[i + 1] = 68;
              overlayData[i + 2] = 68;
              overlayData[i + 3] = Math.round((maskOpacityRef.current / 100) * 255);
            } else {
              overlayData[i + 3] = 0;
            }
          }

          tempCtx.putImageData(overlayImageData, 0, 0);
          currentCtx.globalAlpha = 1;
          currentCtx.drawImage(currentTempCanvas, 0, 0);
        }

        currentCtx.globalAlpha = 1;
        currentCtx.globalCompositeOperation = "source-over";
      });
    };

    const drawAt = (point: Point) => {
      const currentMaskCtx = maskCanvasRef.current?.getContext("2d");
      if (!currentMaskCtx) return;

      const points = lastPointRef.current
        ? interpolatePoints(lastPointRef.current, point, brushSizeRef.current)
        : [point];

      currentMaskCtx.fillStyle = activeToolRef.current === "brush" ? "white" : "black";

      for (const p of points) {
        currentMaskCtx.beginPath();
        currentMaskCtx.arc(p.x, p.y, brushSizeRef.current / 2, 0, Math.PI * 2);
        currentMaskCtx.fill();
      }

      lastPointRef.current = point;
      scheduleRedraw();
    };

    const saveHistoryState = () => {
      const currentMaskCanvas = maskCanvasRef.current;
      if (!currentMaskCanvas) return;

      const currentMaskCtx = currentMaskCanvas.getContext("2d");
      if (!currentMaskCtx) return;

      const imageData = currentMaskCtx.getImageData(0, 0, currentMaskCanvas.width, currentMaskCanvas.height);
      const currentHistory = historyRef.current;
      const currentIndex = historyIndexRef.current;
      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(imageData);
      if (newHistory.length > 50) newHistory.shift();

      historyRef.current = newHistory;
      historyIndexRef.current = Math.min(newHistory.length - 1, 49);
    };

    const commitHistoryState = () => {
      requestAnimationFrame(() => {
        setHistory([...historyRef.current]);
        setHistoryIndex(historyIndexRef.current);
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      const point = getCanvasCoords(e.clientX, e.clientY);

      saveHistoryState();

      isDrawingRef.current = true;
      lastPointRef.current = null;
      drawAt(point);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const point = getCanvasCoords(e.clientX, e.clientY);

      updateCursor(point);

      if (isDrawingRef.current) {
        drawAt(point);
      }
    };

    const handleMouseUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        commitHistoryState();
        if (maskCanvasRef.current) {
          onMaskChangeRef.current(maskCanvasRef.current);
        }
      }
    };

    const handleMouseLeave = () => {
      if (isDrawingRef.current) {
        commitHistoryState();
      }
      isDrawingRef.current = false;
      lastPointRef.current = null;
      hideCursor();
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const point = getCanvasCoords(touch.clientX, touch.clientY);

      updateCursor(point);
      saveHistoryState();

      isDrawingRef.current = true;
      lastPointRef.current = null;
      drawAt(point);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const point = getCanvasCoords(touch.clientX, touch.clientY);

      updateCursor(point);

      if (isDrawingRef.current) {
        drawAt(point);
      }
    };

    const handleTouchEnd = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        lastPointRef.current = null;
        commitHistoryState();
        if (maskCanvasRef.current) {
          onMaskChangeRef.current(maskCanvasRef.current);
        }
      }
      hideCursor();
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    onMaskChangeRef.current(maskCanvas);

    const initTempCtx = tempCanvas.getContext("2d");
    if (initTempCtx) {
      initTempCtx.globalCompositeOperation = "source-over";
      initTempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      const maskImageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const maskData = maskImageData.data;
      const overlayImageData = initTempCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const overlayData = overlayImageData.data;

      for (let i = 0; i < maskData.length; i += 4) {
        const maskValue = maskData[i];
        if (maskValue > 127) {
          overlayData[i] = 239;
          overlayData[i + 1] = 68;
          overlayData[i + 2] = 68;
          overlayData[i + 3] = Math.round((maskOpacityRef.current / 100) * 255);
        } else {
          overlayData[i + 3] = 0;
        }
      }

      initTempCtx.putImageData(overlayImageData, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(tempCanvas, 0, 0);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (cursorRafIdRef.current) {
        cancelAnimationFrame(cursorRafIdRef.current);
      }
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [image, initialPreset]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-3 bg-card rounded-lg border border-border shadow-sm">
        <div className="flex items-center gap-1.5 pr-3 border-r border-border">
          <Button
            variant={activeTool === "brush" ? "default" : "ghost"}
            size="sm"
            type="button"
            onClick={() => setActiveTool("brush")}
            title="Brush (B)"
            aria-label="Brush tool"
            className="transition-all"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
              <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
              <path d="M14.5 17.5 4.5 15" />
            </svg>
          </Button>
          <Button
            variant={activeTool === "eraser" ? "default" : "ghost"}
            size="sm"
            type="button"
            onClick={() => setActiveTool("eraser")}
            title="Eraser (E)"
            aria-label="Eraser tool"
            className="transition-all"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
              <path d="M22 21H7" />
              <path d="m5 11 9 9" />
            </svg>
          </Button>
        </div>

        <div className="flex items-center gap-1.5 pr-3 border-r border-border">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (⌘Z)"
            aria-label="Undo"
            className="transition-all"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (⌘⇧Z)"
            aria-label="Redo"
            className="transition-all"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
            </svg>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="brush-size"
            className="text-xs text-foreground/60 font-medium uppercase tracking-wide whitespace-nowrap"
          >
            Size
          </label>
          <input
            id="brush-size"
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            aria-label="Brush size"
          />
          <span className="text-xs text-foreground/60 w-7 tabular-nums text-right">{brushSize}</span>
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="mask-opacity"
            className="text-xs text-foreground/60 font-medium uppercase tracking-wide whitespace-nowrap"
          >
            Opacity
          </label>
          <input
            id="mask-opacity"
            type="range"
            min="20"
            max="100"
            value={maskOpacity}
            onChange={(e) => setMaskOpacity(Number(e.target.value))}
            className="w-16 h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            aria-label="Mask opacity"
          />
          <span className="text-xs text-foreground/60 w-8 tabular-nums text-right">{maskOpacity}%</span>
        </div>

        <button
          type="button"
          onClick={clearMask}
          className="ml-auto px-3 py-1.5 text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
          aria-label="Clear all mask"
        >
          Clear All
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <span className="text-xs text-foreground/60 font-medium uppercase tracking-wide whitespace-nowrap">
          Quick Masks
        </span>
        <div className="flex items-center gap-2 mr-3">
          <input
            id="preset-size"
            type="range"
            min="5"
            max="40"
            value={maskSize}
            onChange={(e) => setMaskSize(Number(e.target.value))}
            className="w-16 h-1.5 bg-border rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground/60 [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-foreground/60 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
            aria-label="Preset mask size"
          />
          <span className="text-xs text-foreground/50 w-7 tabular-nums text-right">{maskSize}%</span>
        </div>
        {PRESET_MASKS.map((preset) => (
          <Button
            key={preset.id}
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => applyPresetMask(preset.id)}
            className="text-xs transition-all"
            aria-label={`Apply ${preset.label} preset mask`}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="relative border rounded-lg overflow-hidden bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-size-[16px_16px] shadow-sm">
        <canvas
          ref={canvasRef}
          className="block max-w-full h-auto transition-opacity"
          style={{
            maxHeight: "500px",
            cursor: "none",
          }}
          aria-label="Watermark selection canvas"
        />
        <div
          ref={cursorRef}
          className="absolute pointer-events-none rounded-full border-2 hidden z-10 will-change-[left,top,width,height]"
          style={{
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-foreground/50">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono shadow-sm">B</kbd>
            <span>Brush</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono shadow-sm">E</kbd>
            <span>Eraser</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono shadow-sm">[</kbd>
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono shadow-sm">]</kbd>
            <span>Size</span>
          </span>
          <span className="hidden sm:inline-flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono shadow-sm">
              {navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono shadow-sm">Z</kbd>
            <span>Undo</span>
          </span>
        </div>
      </div>
      <p className="flex-1 min-w-0 text-xs text-foreground/50">Draw over the watermark area to mark it for removal</p>
    </div>
  );
}
