import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CanvasAreaProps {
  className?: string;
  image?: string | null;
  processedImage?: string | null;
  isProcessing?: boolean;
  processingProgress?: number;
  onImageUpload?: (file: File) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToScreen?: () => void;
  zoom?: number;
  children?: React.ReactNode;
}

type ViewMode = "after" | "before";

export function CanvasArea({
  className,
  image,
  processedImage,
  isProcessing = false,
  processingProgress = 0,
  onImageUpload,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  zoom = 100,
  children,
}: CanvasAreaProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("after");
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      onImageUpload?.(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onImageUpload?.(files[0]);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const displayImage = viewMode === "before" ? image : processedImage || image;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className={cn(
        "flex-1 flex flex-col",
        "bg-[hsl(210,20%,95%)] dark:bg-[hsl(225,15%,6%)]",
        "overflow-hidden",
        className
      )}
    >
      {/* Canvas Container */}
      <div
        className={cn(
          "flex-1 flex items-center justify-center p-4 md:p-8",
          "relative overflow-hidden"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(
                "absolute inset-4 z-10 rounded-3xl",
                "border-2 border-dashed border-[#00C4CC]",
                "bg-[#00C4CC]/5 backdrop-blur-sm",
                "flex items-center justify-center"
              )}
            >
              <div className="text-center">
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Upload className="h-16 w-16 text-[#00C4CC] mx-auto mb-4" strokeWidth={1.5} />
                </motion.div>
                <p className="text-xl font-semibold text-[#00C4CC]">
                  Drop your image here
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {!image ? (
          // Canva-style Upload Dropzone
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleUploadClick}
            className={cn(
              "w-full max-w-2xl cursor-pointer",
              "rounded-3xl",
              "bg-white dark:bg-[hsl(225,15%,11%)]",
              "border border-gray-200/60 dark:border-gray-800/60",
              "shadow-xl shadow-black/5 dark:shadow-black/20",
              "overflow-hidden",
              "group"
            )}
          >
            {/* Hero Section */}
            <div className="relative p-8 md:p-12 text-center">
              {/* Gradient background effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#00C4CC]/5 via-transparent to-[#7B2FF7]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                className={cn(
                  "w-24 h-24 mx-auto mb-6 rounded-3xl",
                  "bg-gradient-to-br from-[#00C4CC]/10 to-[#7B2FF7]/10",
                  "dark:from-[#00C4CC]/20 dark:to-[#7B2FF7]/20",
                  "flex items-center justify-center",
                  "border border-[#00C4CC]/20",
                  "group-hover:shadow-lg group-hover:shadow-[#00C4CC]/10",
                  "transition-all duration-300"
                )}
              >
                <Sparkles
                  className={cn(
                    "h-10 w-10 text-[#00C4CC]",
                    "transition-transform duration-300",
                    "group-hover:scale-110"
                  )}
                  strokeWidth={1.5}
                />
              </motion.div>
              
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3 font-display">
                Remove Background Instantly
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
                Upload any image and watch the magic happen. Our AI removes backgrounds in seconds.
              </p>
              
              <Button
                variant="default"
                size="lg"
                className={cn(
                  "gap-3 px-8 py-6 text-base rounded-2xl font-semibold",
                  "bg-gradient-to-r from-[#00C4CC] to-[#00A3A9]",
                  "hover:from-[#00D4DD] hover:to-[#00B3B9]",
                  "shadow-xl shadow-[#00C4CC]/25",
                  "group-hover:shadow-2xl group-hover:shadow-[#00C4CC]/30",
                  "transition-all duration-300"
                )}
              >
                <Upload className="h-5 w-5" />
                Upload Image
                <ArrowRight className="h-4 w-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
              </Button>
            </div>

            {/* Bottom Info Section */}
            <div className="px-8 md:px-12 py-6 bg-gray-50/50 dark:bg-gray-900/30 border-t border-gray-200/60 dark:border-gray-800/60">
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  PNG, JPG, WebP
                </span>
                <span className="hidden sm:block">•</span>
                <span>Max 50MB</span>
                <span className="hidden sm:block">•</span>
                <span>Free to use</span>
              </div>
            </div>
          </motion.div>
        ) : children ? (
          // Use custom canvas component
          <div className="w-full h-full relative">
            {children}
            
            {/* Optimized processing indicator - non-blocking floating badge */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    "absolute bottom-4 left-1/2 -translate-x-1/2 z-10",
                    "flex items-center gap-3 px-4 py-2.5",
                    "bg-white/95 dark:bg-[hsl(225,15%,11%)]/95",
                    "backdrop-blur-xl rounded-full",
                    "border border-gray-200/60 dark:border-gray-700/60",
                    "shadow-lg shadow-black/10"
                  )}
                >
                  <div className="relative w-5 h-5">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className={cn(
                        "w-5 h-5 rounded-full",
                        "border-2 border-gray-200 dark:border-gray-700",
                        "border-t-[#00C4CC]"
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      Processing
                    </span>
                    <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#00C4CC] to-[#00A3A9] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${processingProgress}%` }}
                        transition={{ duration: 0.1, ease: "linear" }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums w-8">
                      {Math.round(processingProgress)}%
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          // Default Preview Canvas with built-in image display
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "relative rounded-2xl overflow-hidden",
                "shadow-2xl shadow-black/20 dark:shadow-black/50",
                "checkered-bg"
              )}
              style={{
                transform: `scale(${zoom / 100})`,
                transition: "transform 0.2s ease-out",
              }}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={viewMode}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  src={displayImage || undefined}
                  alt="Preview"
                  className="max-w-full max-h-[calc(100vh-220px)] object-contain"
                  draggable={false}
                />
              </AnimatePresence>

              {/* Processing overlay */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "absolute inset-0",
                      "bg-white/90 dark:bg-[hsl(225,15%,8%)]/90",
                      "backdrop-blur-sm",
                      "flex items-center justify-center"
                    )}
                  >
                    <div className="text-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className={cn(
                          "w-12 h-12 rounded-full mx-auto mb-4",
                          "border-4 border-gray-200 dark:border-gray-700",
                          "border-t-[#00C4CC]"
                        )}
                      />
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        Processing...
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </div>

      {/* Bottom Controls - Canva-style floating bar */}
      {image && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className={cn(
            "absolute bottom-6 left-1/2 -translate-x-1/2",
            "flex items-center gap-2 p-2",
            "bg-white/95 dark:bg-[hsl(225,15%,11%)]/95",
            "backdrop-blur-xl",
            "rounded-2xl",
            "border border-gray-200/60 dark:border-gray-700/60",
            "shadow-xl shadow-black/10 dark:shadow-black/30"
          )}
        >
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 px-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomOut}
              disabled={zoom <= 10}
              className="h-9 w-9 rounded-xl"
              title="Zoom out (Scroll down)"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-14 text-center text-sm font-medium text-gray-600 dark:text-gray-300 tabular-nums">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onZoomIn}
              disabled={zoom >= 500}
              className="h-9 w-9 rounded-xl"
              title="Zoom in (Scroll up)"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onFitToScreen}
              className="h-9 w-9 rounded-xl"
              title="Fit to screen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 px-2">
            <Button
              variant={viewMode === "before" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("before")}
              className={cn(
                "gap-2 rounded-xl font-medium",
                viewMode === "before" && "bg-gray-100 dark:bg-gray-800"
              )}
            >
              <EyeOff className="h-4 w-4" />
              Original
            </Button>
            <Button
              variant={viewMode === "after" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("after")}
              className={cn(
                "gap-2 rounded-xl font-medium",
                viewMode === "after" && "bg-[#00C4CC]/10 text-[#00C4CC]"
              )}
            >
              <Eye className="h-4 w-4" />
              Result
            </Button>
          </div>
        </motion.div>
      )}
    </motion.main>
  );
}

export default CanvasArea;
