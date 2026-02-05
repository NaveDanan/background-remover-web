import * as React from "react";
import { saveAs } from "file-saver";
import { Download, Image as ImageIcon, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExportFormat = "png" | "webp";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageData: ImageData | null;
  originalFileName: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getBaseFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const mimeType = format === "png" ? "image/png" : "image/webp";
    const qualityValue = format === "webp" ? quality / 100 : undefined;
    canvas.toBlob(resolve, mimeType, qualityValue);
  });
}

export function ExportDialog({
  open,
  onOpenChange,
  imageData,
  originalFileName,
}: ExportDialogProps) {
  const [format, setFormat] = React.useState<ExportFormat>("png");
  const [quality, setQuality] = React.useState(90);
  const [estimatedSize, setEstimatedSize] = React.useState<string>("");
  const [previewUrl, setPreviewUrl] = React.useState<string>("");
  const [isDownloading, setIsDownloading] = React.useState(false);

  // Generate preview URL and estimate file size
  React.useEffect(() => {
    if (!imageData || !open) {
      setPreviewUrl("");
      setEstimatedSize("");
      return;
    }

    const canvas = imageDataToCanvas(imageData);
    
    // Generate preview URL
    const url = canvas.toDataURL("image/png");
    setPreviewUrl(url);

    // Estimate file size
    const estimateSize = async () => {
      const blob = await canvasToBlob(canvas, format, quality);
      if (blob) {
        setEstimatedSize(formatFileSize(blob.size));
      }
    };
    
    estimateSize();

    return () => {
      // Clean up is not needed for data URLs, but good practice
    };
  }, [imageData, open, format, quality]);

  const handleDownload = React.useCallback(async () => {
    if (!imageData) return;

    setIsDownloading(true);
    try {
      const canvas = imageDataToCanvas(imageData);
      const blob = await canvasToBlob(canvas, format, quality);
      
      if (blob) {
        const baseName = getBaseFileName(originalFileName);
        const fileName = `${baseName}-no-bg.${format}`;
        saveAs(blob, fileName);
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to download image:", error);
    } finally {
      setIsDownloading(false);
    }
  }, [imageData, format, quality, originalFileName, onOpenChange]);

  const dimensions = imageData
    ? `${imageData.width} × ${imageData.height}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-xl">
            <div className={cn(
              "p-2 rounded-xl",
              "bg-gradient-to-br from-[#00C4CC]/10 to-[#7B2FF7]/10"
            )}>
              <Sparkles className="h-5 w-5 text-[#00C4CC]" strokeWidth={2} />
            </div>
            Download Image
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Choose your preferred format and quality settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Preview
            </label>
            <div
              className={cn(
                "relative mx-auto flex aspect-video max-h-52 items-center justify-center overflow-hidden rounded-2xl",
                "border border-gray-200 dark:border-gray-700",
                "bg-gray-100 dark:bg-gray-800"
              )}
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                  linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                  linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                `,
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <ImageIcon className="h-10 w-10" strokeWidth={1.5} />
                  <span className="text-sm">No preview available</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              {dimensions && (
                <span className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{dimensions}</span>
                  <span>px</span>
                </span>
              )}
              {estimatedSize && (
                <span className="flex items-center gap-1.5">
                  <span>≈</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{estimatedSize}</span>
                </span>
              )}
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat("png")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  format === "png"
                    ? "border-[#00C4CC] bg-[#00C4CC]/5"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <span className={cn(
                  "text-base font-semibold",
                  format === "png" ? "text-[#00C4CC]" : "text-gray-900 dark:text-white"
                )}>
                  PNG
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Lossless quality, best for transparency
                </span>
              </button>
              <button
                onClick={() => setFormat("webp")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
                  format === "webp"
                    ? "border-[#00C4CC] bg-[#00C4CC]/5"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                )}
              >
                <span className={cn(
                  "text-base font-semibold",
                  format === "webp" ? "text-[#00C4CC]" : "text-gray-900 dark:text-white"
                )}>
                  WebP
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  Smaller file size, modern format
                </span>
              </button>
            </div>
          </div>

          {/* Quality Slider (WebP only) */}
          {format === "webp" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="quality-slider"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Quality
                </label>
                <span className="text-sm font-semibold px-2 py-1 rounded-lg bg-[#00C4CC]/10 text-[#00C4CC]">
                  {quality}%
                </span>
              </div>
              <Slider
                id="quality-slider"
                min={75}
                max={100}
                step={1}
                value={[quality]}
                onValueChange={([value]) => setQuality(value)}
                showTooltip
                aria-label="WebP quality"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Higher quality results in larger file size
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDownloading}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!imageData || isDownloading}
            className={cn(
              "gap-2 rounded-xl",
              "bg-gradient-to-r from-[#00C4CC] to-[#00A3A9]",
              "hover:from-[#00D4DD] hover:to-[#00B3B9]"
            )}
          >
            <Download className="h-4 w-4" />
            {isDownloading ? "Downloading..." : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
