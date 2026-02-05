import * as React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { decodeMaskFromRLE } from "@/lib/maskUtils";
import type { MagicRegion } from "@/types";

interface MagicSelectionOverlayProps {
  previewRegion: MagicRegion | null;
  appliedRegions: MagicRegion[];
  imageWidth: number;
  imageHeight: number;
  displayWidth: number;
  displayHeight: number;
  onApply?: (mode: 'keep' | 'remove') => void;
  onCancel?: () => void;
}

export function MagicSelectionOverlay({
  previewRegion,
  appliedRegions,
  imageWidth,
  imageHeight,
  displayWidth,
  displayHeight,
  onApply,
  onCancel,
}: MagicSelectionOverlayProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationRef = React.useRef<number>(0);
  const offsetRef = React.useRef(0);

  // Calculate scale factor for display
  const scaleX = displayWidth / imageWidth;
  const scaleY = displayHeight / imageHeight;

  // Draw marching ants animation for preview region
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size with DPR
    const dpr = window.devicePixelRatio || 1;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);

    const animate = () => {
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Draw applied regions with solid overlay
      for (const region of appliedRegions) {
        drawRegionOverlay(ctx, region, scaleX, scaleY, region.mode);
      }

      // Draw preview region with marching ants
      if (previewRegion) {
        drawMarchingAnts(ctx, previewRegion, scaleX, scaleY, offsetRef.current);
        offsetRef.current = (offsetRef.current + 0.5) % 16;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [previewRegion, appliedRegions, displayWidth, displayHeight, scaleX, scaleY]);

  // Get button position based on preview region bounds
  const buttonPosition = React.useMemo(() => {
    if (!previewRegion) return null;

    const { bounds } = previewRegion;
    const x = (bounds.x + bounds.width) * scaleX;
    const y = bounds.y * scaleY;

    // Ensure buttons stay within canvas bounds
    const adjustedX = Math.min(x + 8, displayWidth - 120);
    const adjustedY = Math.max(y, 8);

    return { x: adjustedX, y: adjustedY };
  }, [previewRegion, scaleX, scaleY, displayWidth]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Selection overlay canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          width: displayWidth,
          height: displayHeight,
        }}
      />

      {/* Apply buttons - positioned next to the selected region */}
      {previewRegion && buttonPosition && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          className="absolute z-10 pointer-events-auto"
          style={{
            left: buttonPosition.x,
            top: buttonPosition.y,
          }}
        >
          <div className={cn(
            "flex flex-col gap-1.5 p-1.5",
            "bg-white/95 dark:bg-gray-900/95",
            "backdrop-blur-sm",
            "rounded-xl",
            "shadow-xl shadow-black/20",
            "border border-gray-200/60 dark:border-gray-700/60"
          )}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onApply?.('keep')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5",
                "bg-emerald-500 hover:bg-emerald-600",
                "text-white text-xs font-medium",
                "rounded-lg",
                "transition-colors duration-150"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Keep
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onApply?.('remove')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5",
                "bg-rose-500 hover:bg-rose-600",
                "text-white text-xs font-medium",
                "rounded-lg",
                "transition-colors duration-150"
              )}
            >
              <Eraser className="h-3.5 w-3.5" />
              Remove
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onCancel}
              className={cn(
                "px-3 py-1 text-xs",
                "text-gray-500 hover:text-gray-700",
                "dark:text-gray-400 dark:hover:text-gray-200",
                "transition-colors duration-150"
              )}
            >
              Cancel
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Draw a filled overlay for applied regions
 */
function drawRegionOverlay(
  ctx: CanvasRenderingContext2D,
  region: MagicRegion,
  scaleX: number,
  scaleY: number,
  mode: 'keep' | 'remove'
): void {
  const { bounds, maskRLE } = region;
  
  // Decode RLE mask for rendering
  const maskSize = bounds.width * bounds.height;
  const mask = decodeMaskFromRLE(maskRLE, maskSize);

  // Draw semi-transparent overlay using the mask
  const imageData = ctx.createImageData(bounds.width, bounds.height);
  const data = imageData.data;
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) {
      const idx = i * 4;
      if (mode === 'keep') {
        data[idx] = 16;
        data[idx + 1] = 185;
        data[idx + 2] = 129;
      } else {
        data[idx] = 244;
        data[idx + 1] = 63;
        data[idx + 2] = 94;
      }
      data[idx + 3] = 80; // Alpha
    }
  }

  // Create temp canvas for the mask
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = bounds.width;
  tempCanvas.height = bounds.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.putImageData(imageData, 0, 0);

  // Draw scaled
  ctx.drawImage(
    tempCanvas,
    bounds.x * scaleX,
    bounds.y * scaleY,
    bounds.width * scaleX,
    bounds.height * scaleY
  );
}

/**
 * Draw marching ants border for preview region
 */
function drawMarchingAnts(
  ctx: CanvasRenderingContext2D,
  region: MagicRegion,
  scaleX: number,
  scaleY: number,
  offset: number
): void {
  const { bounds, maskRLE } = region;

  // Decode RLE mask for rendering
  const maskSize = bounds.width * bounds.height;
  const mask = decodeMaskFromRLE(maskRLE, maskSize);

  // Create a path from the mask edge pixels
  // For performance, we'll trace the bounding box with marching ants
  // and draw a semi-transparent fill

  // Draw semi-transparent fill
  const imageData = ctx.createImageData(bounds.width, bounds.height);
  const data = imageData.data;
  
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 0) {
      const idx = i * 4;
      data[idx] = 0;
      data[idx + 1] = 196;
      data[idx + 2] = 204;
      data[idx + 3] = 60; // Semi-transparent cyan
    }
  }

  // Create temp canvas for the mask
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = bounds.width;
  tempCanvas.height = bounds.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.putImageData(imageData, 0, 0);

  // Draw scaled overlay
  ctx.drawImage(
    tempCanvas,
    bounds.x * scaleX,
    bounds.y * scaleY,
    bounds.width * scaleX,
    bounds.height * scaleY
  );

  // Draw marching ants border around bounding box
  ctx.save();
  ctx.strokeStyle = '#00C4CC';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -offset;
  
  ctx.strokeRect(
    bounds.x * scaleX,
    bounds.y * scaleY,
    bounds.width * scaleX,
    bounds.height * scaleY
  );

  // Draw second pass with white for contrast
  ctx.strokeStyle = '#ffffff';
  ctx.lineDashOffset = -offset + 6;
  ctx.strokeRect(
    bounds.x * scaleX,
    bounds.y * scaleY,
    bounds.width * scaleX,
    bounds.height * scaleY
  );

  ctx.restore();
}

export default MagicSelectionOverlay;
