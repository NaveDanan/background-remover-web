import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Header } from "./Header";
import { ToolRail, type ToolType } from "./ToolRail";
import { ToolPanel, type SidebarSettings } from "./Sidebar";
import { CanvasArea } from "./CanvasArea";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  className?: string;
  children?: React.ReactNode;
  // Header props
  onExport?: () => void;
  isExportDisabled?: boolean;
  statusText?: string;
  fileName?: string;
  // Sidebar/Panel props
  settings: SidebarSettings;
  onSettingsChange: (settings: Partial<SidebarSettings>) => void;
  /** Called when user commits a change (slider release, mode click) - triggers processing */
  onSettingsCommit?: (settings: Partial<SidebarSettings>) => void;
  onAddColor?: () => void;
  onRemoveColor?: (id: string) => void;
  // Magic selection props
  onMagicApply?: (mode: 'keep' | 'remove') => void;
  onMagicCancel?: () => void;
  onMagicRegionRemove?: (id: string) => void;
  onMagicClearAll?: () => void;
  onMagicApplyAll?: () => void;
  onMagicActiveChange?: (active: boolean) => void;
  // Canvas props
  image?: string | null;
  processedImage?: string | null;
  isProcessing?: boolean;
  processingProgress?: number;
  onImageUpload?: (file: File) => void;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitToScreen?: () => void;
  canvasChildren?: React.ReactNode;
}

const MOBILE_BREAKPOINT = 768;

export function Layout({
  className,
  children,
  onExport,
  isExportDisabled,
  statusText,
  fileName,
  settings,
  onSettingsChange,
  onSettingsCommit,
  onAddColor,
  onRemoveColor,
  onMagicApply,
  onMagicCancel,
  onMagicRegionRemove,
  onMagicClearAll,
  onMagicApplyAll,
  onMagicActiveChange,
  image,
  processedImage,
  isProcessing,
  processingProgress = 0,
  onImageUpload,
  zoom = 100,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  canvasChildren,
}: LayoutProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [activeTool, setActiveTool] = React.useState<ToolType | null>(null);

  // Handle responsive layout
  React.useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle tool selection
  const handleToolSelect = (tool: ToolType) => {
    if (tool === "upload") {
      // Trigger file input click - handled by CanvasArea
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fileInput?.click();
      return;
    }
    
    // Toggle panel
    const newActiveTool = activeTool === tool ? null : tool;
    setActiveTool(newActiveTool);

    // Handle magic selection mode activation
    if (tool === "magic") {
      onMagicActiveChange?.(newActiveTool === "magic");
    } else if (activeTool === "magic") {
      // Deactivate magic mode when switching to another tool
      onMagicActiveChange?.(false);
    }
  };



  // Close mobile menu
  const handleMobileOverlayClick = () => {
    setIsMobileMenuOpen(false);
  };

  const hasImage = Boolean(image);

  return (
    <div
      className={cn(
        "min-h-screen h-screen w-full overflow-hidden",
        "bg-gray-100/50 dark:bg-[hsl(225,15%,6%)]",
        className
      )}
    >
      {/* Header */}
      <Header
        onExport={onExport}
        isExportDisabled={isExportDisabled}
        statusText={statusText}
        fileName={fileName}
      />

      {/* Desktop: Tool Rail */}
      {!isMobile && (
        <ToolRail
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
          hasImage={hasImage}
        />
      )}

      {/* Desktop: Floating Tool Panel */}
      {!isMobile && (
        <ToolPanel
          activeTool={activeTool}
          onClose={() => setActiveTool(null)}
          settings={settings}
          onSettingsChange={onSettingsChange}
          onSettingsCommit={onSettingsCommit}
          onAddColor={onAddColor}
          onRemoveColor={onRemoveColor}
          onMagicApply={onMagicApply}
          onMagicCancel={onMagicCancel}
          onMagicRegionRemove={onMagicRegionRemove}
          onMagicClearAll={onMagicClearAll}
          onMagicApplyAll={onMagicApplyAll}
        />
      )}

      {/* Mobile: Floating Action Button */}
      {isMobile && hasImage && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <Button
            variant="default"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "h-14 w-14 rounded-full shadow-xl",
              "bg-gradient-to-br from-[#00C4CC] to-[#00A3A9]",
              "hover:from-[#00D4DD] hover:to-[#00B3B9]"
            )}
          >
            <AnimatePresence mode="wait">
              {isMobileMenuOpen ? (
                <motion.span
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-6 w-6" />
                </motion.span>
              ) : (
                <motion.span
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-6 w-6" />
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      )}

      {/* Mobile: Bottom Sheet */}
      <AnimatePresence>
        {isMobile && isMobileMenuOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleMobileOverlayClick}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              style={{ top: 60 }}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 350 }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-50",
                "max-h-[75vh] overflow-hidden",
                "bg-white dark:bg-[hsl(225,15%,11%)]",
                "rounded-t-3xl",
                "shadow-2xl shadow-black/30"
              )}
            >
              {/* Handle */}
              <div className="flex justify-center py-4">
                <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto max-h-[calc(75vh-56px)] pb-safe px-6 pb-8">
                {/* Mobile tool panels inline */}
                <div className="space-y-6">
                  {/* Quick mode selection */}
                  <ToolPanel
                    activeTool="mode"
                    onClose={() => {}}
                    settings={settings}
                    onSettingsChange={onSettingsChange}
                    onSettingsCommit={onSettingsCommit}
                    onAddColor={onAddColor}
                    onRemoveColor={onRemoveColor}
                    onMagicApply={onMagicApply}
                    onMagicCancel={onMagicCancel}
                    onMagicRegionRemove={onMagicRegionRemove}
                    onMagicClearAll={onMagicClearAll}
                    onMagicApplyAll={onMagicApplyAll}
                    className="relative left-0 top-0 m-0 w-full shadow-none border-0 bg-transparent"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Grid */}
      <div
        className={cn(
          "h-[calc(100vh-60px)] mt-[60px] flex flex-col",
          !isMobile && "ml-[68px]" // Account for tool rail width on desktop
        )}
      >
        {/* Canvas Area */}
        <CanvasArea
          image={image}
          processedImage={processedImage}
          isProcessing={isProcessing}
          processingProgress={processingProgress}
          onImageUpload={onImageUpload}
          zoom={zoom}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
          onFitToScreen={onFitToScreen}
        >
          {canvasChildren}
        </CanvasArea>
      </div>

      {/* Additional children */}
      {children}
    </div>
  );
}

export default Layout;
