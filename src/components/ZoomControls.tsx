import * as React from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ZoomLevel } from "./PreviewCanvas";
import { ZOOM_LEVELS } from "./PreviewCanvas";

interface ZoomControlsProps {
  zoom: ZoomLevel;
  onZoomChange: (zoom: ZoomLevel) => void;
  onFitToScreen: () => void;
  className?: string;
}

export function ZoomControls({
  zoom,
  onZoomChange,
  onFitToScreen,
  className,
}: ZoomControlsProps) {
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const currentZoomIndex = zoom === "fit" ? -1 : ZOOM_LEVELS.indexOf(zoom as typeof ZOOM_LEVELS[number]);

  const handleZoomOut = React.useCallback(() => {
    if (zoom === "fit") {
      onZoomChange(100);
      return;
    }
    const currentIndex = ZOOM_LEVELS.indexOf(zoom as typeof ZOOM_LEVELS[number]);
    if (currentIndex > 0) {
      onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  }, [zoom, onZoomChange]);

  const handleZoomIn = React.useCallback(() => {
    if (zoom === "fit") {
      onZoomChange(100);
      return;
    }
    const currentIndex = ZOOM_LEVELS.indexOf(zoom as typeof ZOOM_LEVELS[number]);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  }, [zoom, onZoomChange]);

  const handleSelectZoom = React.useCallback(
    (level: ZoomLevel) => {
      onZoomChange(level);
      setIsDropdownOpen(false);
    },
    [onZoomChange]
  );

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close dropdown on escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

  const displayZoom = zoom === "fit" ? "Fit" : `${zoom}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-1 rounded-full bg-slate-900/80 p-1 shadow-lg backdrop-blur-md dark:bg-white/80",
        className
      )}
    >
      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={currentZoomIndex === 0}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          "text-white hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent",
          "dark:text-slate-900 dark:hover:bg-slate-900/20 dark:disabled:hover:bg-transparent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        )}
        aria-label="Zoom out"
        title="Zoom out (Scroll down)"
      >
        <ZoomOut className="h-4 w-4" />
      </button>

      {/* Zoom Level Dropdown */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={cn(
            "flex h-8 min-w-[72px] items-center justify-center gap-1 rounded-full px-2 transition-colors",
            "text-sm font-medium text-white hover:bg-white/20",
            "dark:text-slate-900 dark:hover:bg-slate-900/20",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          )}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
        >
          <span>{displayZoom}</span>
          <ChevronDown
            className={cn(
              "h-3 w-3 transition-transform duration-200",
              isDropdownOpen && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 overflow-hidden rounded-lg bg-slate-900 p-1 shadow-xl dark:bg-white"
            role="listbox"
          >
            <button
              type="button"
              onClick={() => {
                onFitToScreen();
                setIsDropdownOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-center rounded-md px-4 py-1.5 text-sm transition-colors",
                "text-white hover:bg-white/20 dark:text-slate-900 dark:hover:bg-slate-900/10",
                zoom === "fit" && "bg-white/20 dark:bg-slate-900/10"
              )}
              role="option"
              aria-selected={zoom === "fit"}
            >
              Fit
            </button>
            {ZOOM_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => handleSelectZoom(level)}
                className={cn(
                  "flex w-full items-center justify-center rounded-md px-4 py-1.5 text-sm transition-colors",
                  "text-white hover:bg-white/20 dark:text-slate-900 dark:hover:bg-slate-900/10",
                  zoom === level && "bg-white/20 dark:bg-slate-900/10"
                )}
                role="option"
                aria-selected={zoom === level}
              >
                {level}%
              </button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={handleZoomIn}
        disabled={currentZoomIndex === ZOOM_LEVELS.length - 1}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          "text-white hover:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent",
          "dark:text-slate-900 dark:hover:bg-slate-900/20 dark:disabled:hover:bg-transparent",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        )}
        aria-label="Zoom in"
        title="Zoom in (Scroll up)"
      >
        <ZoomIn className="h-4 w-4" />
      </button>

      {/* Divider */}
      <div className="mx-1 h-4 w-px bg-white/30 dark:bg-slate-900/30" />

      {/* Fit to Screen Button */}
      <button
        type="button"
        onClick={onFitToScreen}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          "text-white hover:bg-white/20",
          "dark:text-slate-900 dark:hover:bg-slate-900/20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
          zoom === "fit" && "bg-white/20 dark:bg-slate-900/10"
        )}
        aria-label="Fit to screen"
        title="Fit to screen"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

export default ZoomControls;
