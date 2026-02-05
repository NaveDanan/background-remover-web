import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

type UploaderState = "idle" | "drag-over" | "uploading" | "error";

interface ImageUploaderProps {
  onImageLoad: (
    file: File,
    imageData: ImageData,
    width: number,
    height: number
  ) => void;
  className?: string;
  disabled?: boolean;
}

export const ImageUploader = React.forwardRef<HTMLDivElement, ImageUploaderProps>(
  ({ onImageLoad, className, disabled = false }, ref) => {
    const [state, setState] = React.useState<UploaderState>("idle");
    const [errorMessage, setErrorMessage] = React.useState<string>("");
    const inputRef = React.useRef<HTMLInputElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);

    const validateFile = (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return `Invalid file type. Please upload PNG, JPEG, or WebP images.`;
      }
      if (file.size > MAX_SIZE_BYTES) {
        return `File too large. Maximum size is 50MB.`;
      }
      return null;
    };

    const processFile = React.useCallback(
      async (file: File) => {
        const error = validateFile(file);
        if (error) {
          setState("error");
          setErrorMessage(error);
          return;
        }

        setState("uploading");
        setErrorMessage("");

        try {
          const imageData = await loadImageToCanvas(file, canvasRef.current!);
          onImageLoad(file, imageData.data, imageData.width, imageData.height);
          setState("idle");
        } catch (err) {
          setState("error");
          setErrorMessage(
            err instanceof Error ? err.message : "Failed to load image"
          );
        }
      },
      [onImageLoad]
    );

    const loadImageToCanvas = (
      file: File,
      canvas: HTMLCanvasElement
    ): Promise<{ data: ImageData; width: number; height: number }> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(url);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) {
            reject(new Error("Failed to get canvas context"));
            return;
          }

          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resolve({
            data: imageData,
            width: canvas.width,
            height: canvas.height,
          });
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load image"));
        };

        img.src = url;
      });
    };

    const handleDragOver = React.useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && state !== "uploading") {
          setState("drag-over");
        }
      },
      [disabled, state]
    );

    const handleDragLeave = React.useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (state === "drag-over") {
          setState("idle");
        }
      },
      [state]
    );

    const handleDrop = React.useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          processFile(files[0]);
        } else {
          setState("idle");
        }
      },
      [disabled, processFile]
    );

    const handleInputChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
          processFile(files[0]);
        }
        // Reset input value so the same file can be selected again
        e.target.value = "";
      },
      [processFile]
    );

    const handleClick = React.useCallback(() => {
      if (!disabled && state !== "uploading") {
        inputRef.current?.click();
      }
    }, [disabled, state]);

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      },
      [handleClick]
    );

    const clearError = React.useCallback(() => {
      if (state === "error") {
        setState("idle");
        setErrorMessage("");
      }
    }, [state]);

    return (
      <>
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        <motion.div
          ref={ref}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Upload image"
          aria-disabled={disabled}
          className={cn(
            "relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all duration-200",
            state === "idle" &&
              "border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50/50 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-950/20",
            state === "drag-over" &&
              "border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/30",
            state === "uploading" &&
              "border-slate-300 bg-slate-50 cursor-wait dark:border-slate-600 dark:bg-slate-800/50",
            state === "error" &&
              "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950/20",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={clearError}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleInputChange}
            className="hidden"
            aria-hidden="true"
            disabled={disabled}
          />

          <AnimatePresence mode="wait">
            {state === "uploading" ? (
              <motion.div
                key="uploading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  <Loader2 className="h-12 w-12 text-violet-500" />
                </motion.div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Loading image...
                </p>
              </motion.div>
            ) : state === "error" ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                  <AlertCircle className="h-8 w-8 text-red-500" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    {errorMessage}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click or drop another image to try again
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <motion.div
                  className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-200",
                    state === "drag-over"
                      ? "bg-violet-200 dark:bg-violet-800/50"
                      : "bg-slate-200 dark:bg-slate-700"
                  )}
                  animate={
                    state === "drag-over"
                      ? { scale: [1, 1.1, 1], y: [0, -5, 0] }
                      : {}
                  }
                  transition={{ duration: 0.4, repeat: state === "drag-over" ? Infinity : 0 }}
                >
                  <Upload
                    className={cn(
                      "h-8 w-8 transition-colors duration-200",
                      state === "drag-over"
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  />
                </motion.div>

                <div className="space-y-2">
                  <p
                    className={cn(
                      "text-base font-medium transition-colors duration-200",
                      state === "drag-over"
                        ? "text-violet-700 dark:text-violet-300"
                        : "text-slate-700 dark:text-slate-200"
                    )}
                  >
                    {state === "drag-over"
                      ? "Drop image here"
                      : "Drop an image here, or click to browse"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Supports PNG, JPEG, WebP • Max 50MB
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Animated border for drag-over state */}
          <AnimatePresence>
            {state === "drag-over" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-violet-500/50 ring-offset-2 ring-offset-transparent"
              />
            )}
          </AnimatePresence>
        </motion.div>
      </>
    );
  }
);

ImageUploader.displayName = "ImageUploader";

export default ImageUploader;
