import { Download, FileImage, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  className?: string;
  onExport?: () => void;
  isExportDisabled?: boolean;
  statusText?: string;
  fileName?: string;
}

export function Header({
  className,
  onExport,
  isExportDisabled = true,
  statusText,
  fileName,
}: HeaderProps) {
  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 h-[60px]",
        "flex items-center justify-between px-4 md:px-6",
        "bg-white/95 dark:bg-[hsl(225,15%,10%)]/95",
        "backdrop-blur-xl",
        "border-b border-gray-200/60 dark:border-gray-800/60",
        className
      )}
    >
      {/* Left: Logo + Branding */}
      <div className="flex items-center gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 cursor-pointer select-none"
        >
          {/* Logo Mark */}
          <div className={cn(
            "relative flex h-10 w-10 items-center justify-center rounded-full overflow-hidden",
            "shadow-lg shadow-[#00C4CC]/20"
          )}>
            <img 
              src="/logo-no-bg.png" 
              alt="NJ-Background Logo" 
              className="h-10 w-10 object-cover"
            />
          </div>
          
          {/* Brand Text */}
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white font-display">
              NJ-Background
            </h1>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 hidden sm:block font-medium">
              Professional Background Removal
            </span>
          </div>
        </motion.div>

        {/* Divider */}
        <div className="hidden md:block w-px h-8 bg-gray-200 dark:bg-gray-700 mx-2" />

        {/* File Context (when image is loaded) */}
        {fileName && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              "hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              "transition-colors duration-150"
            )}
          >
            <FileImage className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
              {fileName}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </motion.button>
        )}
      </div>

      {/* Center: Status */}
      <div className="hidden lg:flex items-center justify-center flex-1 px-8">
        {statusText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full",
              "bg-gray-100/80 dark:bg-gray-800/80",
              "border border-gray-200/50 dark:border-gray-700/50"
            )}
          >
            <div className="w-2 h-2 rounded-full bg-[#00C4CC] animate-pulse" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {statusText}
            </span>
          </motion.div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle />
        
        <Button
          onClick={onExport}
          disabled={isExportDisabled}
          variant="default"
          size="default"
          className={cn(
            "gap-2 rounded-xl font-medium",
            "bg-gradient-to-r from-[#00C4CC] to-[#00A3A9]",
            "hover:from-[#00D4DD] hover:to-[#00B3B9]",
            "shadow-lg shadow-[#00C4CC]/25",
            "disabled:from-gray-300 disabled:to-gray-400 disabled:shadow-none",
            "dark:disabled:from-gray-700 dark:disabled:to-gray-800"
          )}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>
    </motion.header>
  );
}

export default Header;
