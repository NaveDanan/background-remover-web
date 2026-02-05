import * as React from "react";
import { cn } from "@/lib/utils";
import { MagicSelectionOverlay } from "./MagicSelectionOverlay";
import type { MagicRegion } from "@/types";

// Extended zoom levels for better control (10% to 500%)
export const ZOOM_LEVELS = [10, 25, 50, 75, 100, 125, 150, 200, 300, 400, 500] as const;
export type ZoomLevel = "fit" | (typeof ZOOM_LEVELS)[number];

// Zoom limits
export const MIN_ZOOM = ZOOM_LEVELS[0];
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

interface PreviewCanvasProps {
  originalImageData: ImageData | null;
  processedImageData: ImageData | null;
  zoom: ZoomLevel;
  showOriginal: boolean;
  onColorPick?: (color: { r: number; g: number; b: number; hex: string }) => void;
  isColorPickerMode?: boolean;
  isMagicSelectionMode?: boolean;
  onMagicSelect?: (x: number, y: number) => void;
  magicPreviewRegion?: MagicRegion | null;
  magicAppliedRegions?: MagicRegion[];
  onMagicApply?: (mode: 'keep' | 'remove') => void;
  onMagicCancel?: () => void;
  onZoomChange?: (zoom: ZoomLevel) => void;
  className?: string;
}

export interface PreviewCanvasRef {
  toBlob: (type?: string, quality?: number) => Promise<Blob | null>;
  getImageData: () => ImageData | null;
}

const PreviewCanvas = React.forwardRef<PreviewCanvasRef, PreviewCanvasProps>(
  (
    {
      originalImageData,
      processedImageData,
      zoom,
      showOriginal,
      onColorPick,
      isColorPickerMode = false,
      isMagicSelectionMode = false,
      onMagicSelect,
      magicPreviewRegion = null,
      magicAppliedRegions = [],
      onMagicApply,
      onMagicCancel,
      onZoomChange,
      className,
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const checkerCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const imageCanvasRef = React.useRef<HTMLCanvasElement>(null);

    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
    const [pan, setPan] = React.useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = React.useState(false);
    const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
    const [isMiddleButtonPanning, setIsMiddleButtonPanning] = React.useState(false);
    
    // Color picker magnifier state
    const [magnifierPos, setMagnifierPos] = React.useState<{ x: number; y: number } | null>(null);
    const [hoveredColor, setHoveredColor] = React.useState<{ r: number; g: number; b: number } | null>(null);
    const magnifierCanvasRef = React.useRef<HTMLCanvasElement>(null);
    const magnifierTempCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const MAGNIFIER_SIZE = 100;
    const MAGNIFIER_ZOOM = 4;

    // Show original if requested, otherwise show processed (fallback to original if not yet processed)
    const activeImageData = showOriginal 
      ? originalImageData 
      : (processedImageData || originalImageData);

    // Calculate dimensions
    const calculateDimensions = React.useCallback(() => {
      if (!activeImageData || containerSize.width === 0) {
        return { width: 0, height: 0, scale: 1 };
      }

      const padding = 32;
      const availableWidth = containerSize.width - padding * 2;
      const availableHeight = containerSize.height - padding * 2;

      const imgWidth = activeImageData.width;
      const imgHeight = activeImageData.height;

      if (zoom === "fit") {
        const scaleX = availableWidth / imgWidth;
        const scaleY = availableHeight / imgHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        return {
          width: Math.round(imgWidth * scale),
          height: Math.round(imgHeight * scale),
          scale,
        };
      }

      const scale = zoom / 100;
      return {
        width: Math.round(imgWidth * scale),
        height: Math.round(imgHeight * scale),
        scale,
      };
    }, [activeImageData, containerSize, zoom]);

    const dimensions = calculateDimensions();
    const canPan = dimensions.width > containerSize.width || dimensions.height > containerSize.height;

    // Observe container size
    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setContainerSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        }
      });

      observer.observe(container);
      return () => observer.disconnect();
    }, []);

    // Reset pan when zoom changes or image changes
    React.useEffect(() => {
      setPan({ x: 0, y: 0 });
    }, [zoom, activeImageData]);

    // Invalidate magnifier temp canvas when original image changes
    React.useEffect(() => {
      if (magnifierTempCanvasRef.current && originalImageData) {
        const tempCtx = magnifierTempCanvasRef.current.getContext("2d");
        if (tempCtx && magnifierTempCanvasRef.current.width === originalImageData.width) {
          tempCtx.putImageData(originalImageData, 0, 0);
        } else {
          // Will be recreated on next use
          magnifierTempCanvasRef.current = null;
        }
      }
    }, [originalImageData]);

    // Draw checkerboard pattern
    const drawCheckerboard = React.useCallback(
      (canvas: HTMLCanvasElement, width: number, height: number) => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        const tileSize = 8;
        const lightColor = getComputedStyle(document.documentElement)
          .getPropertyValue("--checker-light")
          .trim() || "#f0f0f0";
        const darkColor = getComputedStyle(document.documentElement)
          .getPropertyValue("--checker-dark")
          .trim() || "#e0e0e0";

        for (let y = 0; y < height; y += tileSize) {
          for (let x = 0; x < width; x += tileSize) {
            const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
            ctx.fillStyle = isLight ? lightColor : darkColor;
            ctx.fillRect(x, y, tileSize, tileSize);
          }
        }
      },
      []
    );

    // Draw image - optimized with cached temp canvas
    const tempCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const tempCanvasSizeRef = React.useRef({ width: 0, height: 0 });

    const drawImage = React.useCallback(
      (canvas: HTMLCanvasElement, imageData: ImageData, width: number, height: number) => {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Reuse temp canvas if dimensions match, otherwise create new one
        let tempCanvas = tempCanvasRef.current;
        if (!tempCanvas || 
            tempCanvasSizeRef.current.width !== imageData.width || 
            tempCanvasSizeRef.current.height !== imageData.height) {
          tempCanvas = document.createElement("canvas");
          tempCanvas.width = imageData.width;
          tempCanvas.height = imageData.height;
          tempCanvasRef.current = tempCanvas;
          tempCanvasSizeRef.current = { width: imageData.width, height: imageData.height };
        }

        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;

        tempCtx.putImageData(imageData, 0, 0);

        // Enable image smoothing for better quality when scaling down
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Draw scaled image
        ctx.drawImage(tempCanvas, 0, 0, width, height);
      },
      []
    );

    // Render canvases when data changes
    React.useEffect(() => {
      if (!activeImageData || dimensions.width === 0) return;

      const checkerCanvas = checkerCanvasRef.current;
      const imageCanvas = imageCanvasRef.current;

      if (checkerCanvas) {
        drawCheckerboard(checkerCanvas, dimensions.width, dimensions.height);
      }

      if (imageCanvas) {
        drawImage(imageCanvas, activeImageData, dimensions.width, dimensions.height);
      }
    }, [activeImageData, dimensions, drawCheckerboard, drawImage]);

    // Mouse wheel zoom handler
    const handleWheel = React.useCallback(
      (e: React.WheelEvent) => {
        if (!onZoomChange) return;
        
        e.preventDefault();
        
        const currentNumericZoom = zoom === 'fit' ? 100 : zoom;
        const currentIndex = ZOOM_LEVELS.indexOf(currentNumericZoom as typeof ZOOM_LEVELS[number]);
        
        if (e.deltaY < 0) {
          // Zoom in
          if (currentIndex < ZOOM_LEVELS.length - 1) {
            onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
          } else if (zoom === 'fit') {
            // Find appropriate zoom level when coming from 'fit'
            const fitScale = dimensions.scale * 100;
            const nextLevel = ZOOM_LEVELS.find(z => z > fitScale) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
            onZoomChange(nextLevel);
          }
        } else {
          // Zoom out
          if (currentIndex > 0) {
            onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
          } else if (zoom === 'fit') {
            // Find appropriate zoom level when coming from 'fit'
            const fitScale = dimensions.scale * 100;
            const prevLevel = [...ZOOM_LEVELS].reverse().find(z => z < fitScale) ?? ZOOM_LEVELS[0];
            onZoomChange(prevLevel);
          }
        }
      },
      [zoom, onZoomChange, dimensions.scale]
    );

    // Pan handlers - left click drag (when canPan) or middle mouse button
    const handleMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        // Middle mouse button (button === 1) for panning - works regardless of canPan
        if (e.button === 1) {
          e.preventDefault();
          setIsMiddleButtonPanning(true);
          setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
          return;
        }
        
        // Left click panning only when canPan and not in special modes
        if (isColorPickerMode || isMagicSelectionMode) return;
        if (!canPan) return;

        setIsPanning(true);
        setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      },
      [canPan, isColorPickerMode, isMagicSelectionMode, pan]
    );

    const handleMouseMove = React.useCallback(
      (e: React.MouseEvent) => {
        const activePanning = isPanning || isMiddleButtonPanning;
        if (!activePanning) return;

        const newPanX = e.clientX - panStart.x;
        const newPanY = e.clientY - panStart.y;

        // Calculate bounds - allow panning even when image is smaller if using middle button
        const maxPanX = Math.max(0, (dimensions.width - containerSize.width) / 2 + (isMiddleButtonPanning ? 100 : 0));
        const maxPanY = Math.max(0, (dimensions.height - containerSize.height) / 2 + (isMiddleButtonPanning ? 100 : 0));

        setPan({
          x: Math.max(-maxPanX, Math.min(maxPanX, newPanX)),
          y: Math.max(-maxPanY, Math.min(maxPanY, newPanY)),
        });
      },
      [isPanning, isMiddleButtonPanning, panStart, dimensions, containerSize]
    );

    const handleMouseUp = React.useCallback((e: React.MouseEvent) => {
      if (e.button === 1) {
        setIsMiddleButtonPanning(false);
      }
      setIsPanning(false);
    }, []);

    const handleMouseLeave = React.useCallback(() => {
      setIsPanning(false);
      setIsMiddleButtonPanning(false);
    }, []);

    // Hide magnifier when mouse leaves the image canvas
    const handleCanvasMouseLeave = React.useCallback(() => {
      if (isColorPickerMode) {
        setMagnifierPos(null);
        setHoveredColor(null);
        setImageCoords(null);
      }
    }, [isColorPickerMode]);

    // Store image coordinates for magnifier drawing
    const [imageCoords, setImageCoords] = React.useState<{ imgX: number; imgY: number } | null>(null);

    // Update magnifier when mouse moves in color picker mode
    const handleCanvasMouseMove = React.useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isColorPickerMode || !originalImageData) return;

        const canvas = imageCanvasRef.current;
        if (!canvas) return;

        const canvasRect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Position relative to canvas element
        const canvasX = e.clientX - canvasRect.left;
        const canvasY = e.clientY - canvasRect.top;

        // Position in image coordinates (scaled)
        const imgX = Math.floor((canvasX / canvasRect.width) * canvas.width / dpr);
        const imgY = Math.floor((canvasY / canvasRect.height) * canvas.height / dpr);

        // Get the current pixel color
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const pixel = ctx.getImageData(imgX * dpr, imgY * dpr, 1, 1).data;
        setHoveredColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
        setImageCoords({ imgX, imgY });

        // Center magnifier on cursor position
        const magX = e.clientX - MAGNIFIER_SIZE / 2;
        const magY = e.clientY - MAGNIFIER_SIZE / 2;
        
        setMagnifierPos({ x: magX, y: magY });
      },
      [isColorPickerMode, originalImageData]
    );

    // Draw magnified area in a separate effect (after magnifier canvas is rendered)
    React.useEffect(() => {
      if (!isColorPickerMode || !originalImageData || !imageCoords || !magnifierPos) return;

      const magnifierCanvas = magnifierCanvasRef.current;
      if (!magnifierCanvas) return;

      const magnifierCtx = magnifierCanvas.getContext("2d");
      if (!magnifierCtx) return;

      const { imgX, imgY } = imageCoords;

      // Calculate source position in original image
      const scaleToOriginal = originalImageData.width / dimensions.width;
      const srcX = imgX * scaleToOriginal;
      const srcY = imgY * scaleToOriginal;

      // Source size for magnification
      const srcSize = (MAGNIFIER_SIZE / MAGNIFIER_ZOOM) * scaleToOriginal;

      // Reuse temp canvas for magnifier (avoid creating new one on each mouse move)
      let tempCanvas = magnifierTempCanvasRef.current;
      if (!tempCanvas || tempCanvas.width !== originalImageData.width) {
        tempCanvas = document.createElement("canvas");
        tempCanvas.width = originalImageData.width;
        tempCanvas.height = originalImageData.height;
        magnifierTempCanvasRef.current = tempCanvas;
        // Only draw image data when creating new canvas
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.putImageData(originalImageData, 0, 0);
        }
      }

      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      // Clear and draw magnified portion
      magnifierCtx.clearRect(0, 0, MAGNIFIER_SIZE, MAGNIFIER_SIZE);
      
      // Draw checkerboard background for transparency
      const tileSize = 6;
      for (let y = 0; y < MAGNIFIER_SIZE; y += tileSize) {
        for (let x = 0; x < MAGNIFIER_SIZE; x += tileSize) {
          const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
          magnifierCtx.fillStyle = isLight ? "#f0f0f0" : "#d0d0d0";
          magnifierCtx.fillRect(x, y, tileSize, tileSize);
        }
      }

      // Draw magnified image
      magnifierCtx.imageSmoothingEnabled = false; // Pixelated look for magnification
      magnifierCtx.drawImage(
        tempCanvas,
        srcX - srcSize / 2,
        srcY - srcSize / 2,
        srcSize,
        srcSize,
        0,
        0,
        MAGNIFIER_SIZE,
        MAGNIFIER_SIZE
      );

      // Draw crosshair in center
      magnifierCtx.strokeStyle = "rgba(0,0,0,0.5)";
      magnifierCtx.lineWidth = 1;
      const center = MAGNIFIER_SIZE / 2;
      const crossSize = 8;
      magnifierCtx.beginPath();
      magnifierCtx.moveTo(center - crossSize, center);
      magnifierCtx.lineTo(center + crossSize, center);
      magnifierCtx.moveTo(center, center - crossSize);
      magnifierCtx.lineTo(center, center + crossSize);
      magnifierCtx.stroke();
    }, [isColorPickerMode, originalImageData, imageCoords, magnifierPos, dimensions]);

    // Color picker handler
    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = imageCanvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Calculate click position relative to canvas
        const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width / dpr);
        const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height / dpr);

        // Handle magic selection mode
        if (isMagicSelectionMode && onMagicSelect && originalImageData) {
          // Convert to original image coordinates
          const scaleToOriginal = originalImageData.width / dimensions.width;
          const imgX = Math.floor(x * scaleToOriginal);
          const imgY = Math.floor(y * scaleToOriginal);
          onMagicSelect(imgX, imgY);
          return;
        }

        // Handle color picker mode
        if (!isColorPickerMode || !onColorPick || !activeImageData) return;

        // Get pixel from the displayed (scaled) image
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;

        const pixel = ctx.getImageData(x * dpr, y * dpr, 1, 1).data;
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];

        const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();

        onColorPick({ r, g, b, hex });
      },
      [isColorPickerMode, isMagicSelectionMode, onColorPick, onMagicSelect, activeImageData, originalImageData, dimensions]
    );

    // Expose methods via ref
    React.useImperativeHandle(
      ref,
      () => ({
        toBlob: (type = "image/png", quality = 0.92): Promise<Blob | null> => {
          return new Promise((resolve) => {
            const imageData = showOriginal ? originalImageData : processedImageData;
            if (!imageData) {
              resolve(null);
              return;
            }

            const canvas = document.createElement("canvas");
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve(null);
              return;
            }

            ctx.putImageData(imageData, 0, 0);
            canvas.toBlob(
              (blob) => resolve(blob),
              type,
              quality
            );
          });
        },
        getImageData: () => {
          return showOriginal ? originalImageData : processedImageData;
        },
      }),
      [showOriginal, originalImageData, processedImageData]
    );

    if (!activeImageData) {
      return (
        <div
          ref={containerRef}
          className={cn(
            "flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800/50",
            className
          )}
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No image to display
          </p>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800/50",
          canPan && !isColorPickerMode && !isMagicSelectionMode && "cursor-grab",
          (isPanning || isMiddleButtonPanning) && "cursor-grabbing",
          (isColorPickerMode || isMagicSelectionMode) && "cursor-crosshair",
          className
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="relative"
          style={{
            width: dimensions.width,
            height: dimensions.height,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transition: isPanning ? "none" : "transform 0.1s ease-out",
          }}
        >
          {/* Checkerboard canvas (background) */}
          <canvas
            ref={checkerCanvasRef}
            className="absolute inset-0 rounded-lg"
            style={{
              width: dimensions.width,
              height: dimensions.height,
            }}
          />

          {/* Image canvas (foreground) */}
          <canvas
            ref={imageCanvasRef}
            className="relative rounded-lg"
            style={{
              width: dimensions.width,
              height: dimensions.height,
              cursor: isColorPickerMode ? (magnifierPos ? "none" : "crosshair") : 
                     isMagicSelectionMode ? "crosshair" : undefined,
            }}
            onClick={handleClick}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
          />

          {/* Magic Selection Overlay */}
          {isMagicSelectionMode && originalImageData && (
            <MagicSelectionOverlay
              previewRegion={magicPreviewRegion}
              appliedRegions={magicAppliedRegions}
              imageWidth={originalImageData.width}
              imageHeight={originalImageData.height}
              displayWidth={dimensions.width}
              displayHeight={dimensions.height}
              onApply={onMagicApply}
              onCancel={onMagicCancel}
            />
          )}
        </div>

        {/* Color picker magnifier - using fixed positioning to avoid overflow clipping */}
        {isColorPickerMode && magnifierPos && hoveredColor && (
          <div
            className="pointer-events-none fixed z-[9999]"
            style={{
              left: magnifierPos.x,
              top: magnifierPos.y,
              width: MAGNIFIER_SIZE,
              height: MAGNIFIER_SIZE,
            }}
          >
            {/* Outer color ring */}
            <div
              className="absolute inset-0 rounded-full shadow-xl"
              style={{
                background: `rgb(${hoveredColor.r}, ${hoveredColor.g}, ${hoveredColor.b})`,
                padding: 4,
              }}
            >
              {/* Inner white ring */}
              <div className="h-full w-full rounded-full bg-white p-0.5">
                {/* Magnifier canvas container */}
                <div className="h-full w-full overflow-hidden rounded-full">
                  <canvas
                    ref={magnifierCanvasRef}
                    width={MAGNIFIER_SIZE}
                    height={MAGNIFIER_SIZE}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>
            {/* Color hex label */}
            <div
              className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-mono font-medium shadow-lg"
              style={{
                backgroundColor: `rgb(${hoveredColor.r}, ${hoveredColor.g}, ${hoveredColor.b})`,
                color: (hoveredColor.r * 0.299 + hoveredColor.g * 0.587 + hoveredColor.b * 0.114) > 150 ? '#000' : '#fff',
              }}
            >
              #{hoveredColor.r.toString(16).padStart(2, "0").toUpperCase()}
              {hoveredColor.g.toString(16).padStart(2, "0").toUpperCase()}
              {hoveredColor.b.toString(16).padStart(2, "0").toUpperCase()}
            </div>
          </div>
        )}

        {/* Color picker mode indicator */}
        {isColorPickerMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm dark:bg-white/80 dark:text-gray-900">
            Click to pick a color
          </div>
        )}

        {/* Magic selection mode indicator */}
        {isMagicSelectionMode && !magicPreviewRegion && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#00C4CC] to-[#00A3A9] px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
            Click to select a region
          </div>
        )}
      </div>
    );
  }
);

PreviewCanvas.displayName = "PreviewCanvas";

export default PreviewCanvas;
