import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  MousePointer2,
  Pipette,
  Plus,
  X,
  Check,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Eraser,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { ToolType } from "./ToolRail";
import type { MagicRegion } from "@/types";

export type RemovalMode = "auto" | "manual" | "colorPicker";
export type EdgeQuality = "hard" | "feathered" | "decontaminate" | "smooth" | "refine";

export interface ColorSwatch {
  id: string;
  color: string;
}

export interface SidebarSettings {
  mode: RemovalMode;
  threshold: number;
  edgeQuality: EdgeQuality;
  featherRadius: number;
  selectedColors: ColorSwatch[];
  // Magic selection settings
  magicTolerance: number;
  magicPreviewRegion: MagicRegion | null;
  magicAppliedRegions: MagicRegion[];
}

interface ToolPanelProps {
  className?: string;
  activeTool: ToolType | null;
  onClose: () => void;
  settings: SidebarSettings;
  /** Called during slider drag for UI preview (not for processing) */
  onSettingsChange: (settings: Partial<SidebarSettings>) => void;
  /** Called when user commits a change (slider release, mode click) - triggers actual processing */
  onSettingsCommit?: (settings: Partial<SidebarSettings>) => void;
  onAddColor?: () => void;
  onRemoveColor?: (id: string) => void;
  // Magic selection callbacks
  onMagicApply?: (mode: 'keep' | 'remove') => void;
  onMagicCancel?: () => void;
  onMagicRegionRemove?: (id: string) => void;
  onMagicClearAll?: () => void;
  onMagicApplyAll?: () => void;
}

interface PanelHeaderProps {
  title: string;
  onClose: () => void;
}

function PanelHeader({ title, onClose }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200/60 dark:border-gray-700/60">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white font-display">
        {title}
      </h3>
      <button
        onClick={onClose}
        className={cn(
          "p-1.5 rounded-lg",
          "text-gray-400 hover:text-gray-600",
          "dark:text-gray-500 dark:hover:text-gray-300",
          "hover:bg-gray-100 dark:hover:bg-gray-800",
          "transition-colors duration-150"
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ModeOptionProps {
  icon: React.ElementType;
  label: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}

function ModeOption({ icon: Icon, label, description, isActive, onClick }: ModeOptionProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-xl text-left",
        "border-2 transition-all duration-200",
        isActive
          ? "border-[#00C4CC] bg-[#00C4CC]/5 dark:bg-[#00C4CC]/10"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          isActive
            ? "bg-[#00C4CC]/10 text-[#00C4CC]"
            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
        )}>
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium",
              isActive ? "text-[#00C4CC]" : "text-gray-900 dark:text-white"
            )}>
              {label}
            </span>
            {isActive && (
              <Check className="h-4 w-4 text-[#00C4CC]" />
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </motion.button>
  );
}

// Mode Panel
function ModePanel({ settings, onSettingsChange: _onSettingsChange, onSettingsCommit, onClose }: Omit<ToolPanelProps, 'activeTool' | 'onAddColor' | 'onRemoveColor' | 'onMagicApply' | 'onMagicCancel' | 'onMagicRegionRemove' | 'onMagicClearAll'>) {
  // Local preview state for threshold slider
  const [previewThreshold, setPreviewThreshold] = React.useState(settings.threshold);
  
  // Sync local state when settings change externally (e.g., mode switch)
  React.useEffect(() => {
    setPreviewThreshold(settings.threshold);
  }, [settings.threshold]);

  return (
    <div className="space-y-4">
      <PanelHeader title="Removal Mode" onClose={onClose} />
      
      <div className="space-y-3">
        <ModeOption
          icon={Wand2}
          label="Auto"
          description="Automatically detect and remove background"
          isActive={settings.mode === 'auto'}
          onClick={() => onSettingsCommit?.({ mode: 'auto' })}
        />
        <ModeOption
          icon={MousePointer2}
          label="Manual"
          description="Fine-tune with threshold control"
          isActive={settings.mode === 'manual'}
          onClick={() => onSettingsCommit?.({ mode: 'manual' })}
        />
        <ModeOption
          icon={Pipette}
          label="Color Picker"
          description="Select specific colors to remove"
          isActive={settings.mode === 'colorPicker'}
          onClick={() => onSettingsCommit?.({ mode: 'colorPicker' })}
        />
      </div>

      {(settings.mode === 'auto' || settings.mode === 'manual') && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="pt-4 border-t border-gray-200/60 dark:border-gray-700/60"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Threshold
              </span>
              <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-gray-600 dark:text-gray-400">
                {previewThreshold}%
              </span>
            </div>
            <Slider
              value={[previewThreshold]}
              onValueChange={([value]) => setPreviewThreshold(value)}
              onValueCommit={([value]) => onSettingsCommit?.({ threshold: value })}
              min={0}
              max={100}
              step={1}
              showTooltip
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Higher values remove more of the background
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Colors Panel
function ColorsPanel({ settings, onSettingsChange: _onSettingsChange, onSettingsCommit, onAddColor, onRemoveColor, onClose }: Omit<ToolPanelProps, 'activeTool' | 'onMagicApply' | 'onMagicCancel' | 'onMagicRegionRemove' | 'onMagicClearAll'>) {
  return (
    <div className="space-y-4">
      <PanelHeader title="Color Selection" onClose={onClose} />
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click on the image to select colors you want to remove.
        </p>

        {/* Selected Colors */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Selected Colors
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {settings.selectedColors.length} colors
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {settings.selectedColors.map((swatch) => (
                <motion.div
                  key={swatch.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative group"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl shadow-sm",
                      "border-2 border-white dark:border-gray-700",
                      "ring-1 ring-gray-200 dark:ring-gray-600"
                    )}
                    style={{ backgroundColor: swatch.color }}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => onRemoveColor?.(swatch.id)}
                    className={cn(
                      "absolute -top-1.5 -right-1.5",
                      "w-5 h-5 rounded-full",
                      "bg-red-500 text-white",
                      "flex items-center justify-center",
                      "opacity-0 group-hover:opacity-100",
                      "transition-opacity duration-150",
                      "shadow-sm"
                    )}
                  >
                    <X className="h-3 w-3" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddColor}
              className={cn(
                "w-12 h-12 rounded-xl",
                "border-2 border-dashed border-gray-300 dark:border-gray-600",
                "flex items-center justify-center",
                "text-gray-400 dark:text-gray-500",
                "hover:border-[#00C4CC] hover:text-[#00C4CC]",
                "dark:hover:border-[#00C4CC] dark:hover:text-[#00C4CC]",
                "transition-all duration-150"
              )}
            >
              <Plus className="h-5 w-5" />
            </motion.button>
          </div>
        </div>

        {settings.selectedColors.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsCommit?.({ selectedColors: [] })}
            className="w-full gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Clear All Colors
          </Button>
        )}
      </div>
    </div>
  );
}

// Edges Panel
function EdgesPanel({ settings, onSettingsChange: _onSettingsChange, onSettingsCommit, onClose }: Omit<ToolPanelProps, 'activeTool' | 'onAddColor' | 'onRemoveColor' | 'onMagicApply' | 'onMagicCancel' | 'onMagicRegionRemove' | 'onMagicClearAll'>) {
  // Local preview state for feather radius slider
  const [previewFeatherRadius, setPreviewFeatherRadius] = React.useState(settings.featherRadius);
  
  // Sync local state when settings change externally
  React.useEffect(() => {
    setPreviewFeatherRadius(settings.featherRadius);
  }, [settings.featherRadius]);

  // Edge mode options with descriptions for gradient/fade backgrounds
  const edgeModes: Array<{ id: EdgeQuality; label: string; description: string; icon: React.ReactNode }> = [
    {
      id: 'hard',
      label: 'Hard',
      description: 'Sharp binary cutoff',
      icon: (
        <div className="w-full h-full rounded-md bg-gradient-to-br from-gray-800 to-gray-600" 
             style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }} />
      ),
    },
    {
      id: 'feathered',
      label: 'Feathered',
      description: 'Soft gradient falloff',
      icon: (
        <div className="w-full h-full rounded-md bg-gradient-to-br from-gray-800 to-gray-400 blur-[2px]" />
      ),
    },
    {
      id: 'smooth',
      label: 'Smooth',
      description: 'Anti-aliased edges',
      icon: (
        <div className="w-full h-full rounded-md overflow-hidden">
          <div className="w-full h-full bg-gradient-to-br from-gray-700 via-gray-500 to-transparent 
                          [mask-image:linear-gradient(135deg,black_40%,transparent_60%)]" />
        </div>
      ),
    },
    {
      id: 'refine',
      label: 'Refine',
      description: 'Cleans noisy edges',
      icon: (
        <div className="w-full h-full rounded-md bg-gray-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,transparent_30%,rgba(0,0,0,0.3)_70%)]" />
        </div>
      ),
    },
    {
      id: 'decontaminate',
      label: 'Decontam',
      description: 'Removes color spill',
      icon: (
        <div className="w-full h-full rounded-md relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-500" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-emerald-500/30 to-transparent opacity-60" 
               style={{ mixBlendMode: 'multiply' }} />
        </div>
      ),
    },
  ];

  // Determine if feather radius should be shown (all modes except 'hard' use it)
  const showFeatherRadius = settings.edgeQuality !== 'hard';

  // Dynamic label based on selected mode
  const radiusLabel = settings.edgeQuality === 'feathered' ? 'Feather Radius' :
                      settings.edgeQuality === 'smooth' ? 'Smoothness' :
                      settings.edgeQuality === 'refine' ? 'Refinement' :
                      settings.edgeQuality === 'decontaminate' ? 'Strength' : 'Radius';

  return (
    <div className="space-y-4">
      <PanelHeader title="Edge Quality" onClose={onClose} />
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Choose how edges are processed. Better modes help with gradient backgrounds.
        </p>

        {/* Edge mode grid - 2 columns for first 4, full width for last */}
        <div className="grid grid-cols-2 gap-2">
          {edgeModes.slice(0, 4).map((mode) => (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSettingsCommit?.({ edgeQuality: mode.id })}
              className={cn(
                "p-3 rounded-xl text-center",
                "border-2 transition-all duration-200",
                settings.edgeQuality === mode.id
                  ? "border-[#00C4CC] bg-[#00C4CC]/5"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              )}
            >
              <div className={cn(
                "w-9 h-9 mx-auto mb-1.5 rounded-lg overflow-hidden",
                settings.edgeQuality === mode.id ? "opacity-100" : "opacity-60"
              )}>
                {mode.icon}
              </div>
              <span className={cn(
                "text-xs font-medium block",
                settings.edgeQuality === mode.id
                  ? "text-[#00C4CC]"
                  : "text-gray-700 dark:text-gray-300"
              )}>
                {mode.label}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5">
                {mode.description}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Decontaminate - full width as it's special */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSettingsCommit?.({ edgeQuality: 'decontaminate' })}
          className={cn(
            "w-full p-3 rounded-xl",
            "border-2 transition-all duration-200",
            "flex items-center gap-3",
            settings.edgeQuality === 'decontaminate'
              ? "border-[#00C4CC] bg-[#00C4CC]/5"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-lg overflow-hidden flex-shrink-0",
            settings.edgeQuality === 'decontaminate' ? "opacity-100" : "opacity-60"
          )}>
            {edgeModes[4].icon}
          </div>
          <div className="text-left flex-1">
            <span className={cn(
              "text-sm font-medium block",
              settings.edgeQuality === 'decontaminate'
                ? "text-[#00C4CC]"
                : "text-gray-700 dark:text-gray-300"
            )}>
              Decontaminate
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Removes background color bleeding into edges — best for gradient backgrounds
            </span>
          </div>
          {settings.edgeQuality === 'decontaminate' && (
            <Check className="h-4 w-4 text-[#00C4CC] flex-shrink-0" />
          )}
        </motion.button>

        <AnimatePresence>
          {showFeatherRadius && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-4 border-t border-gray-200/60 dark:border-gray-700/60"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {radiusLabel}
                </span>
                <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-gray-600 dark:text-gray-400">
                  {previewFeatherRadius}px
                </span>
              </div>
              <Slider
                value={[previewFeatherRadius]}
                onValueChange={([value]) => setPreviewFeatherRadius(value)}
                onValueCommit={([value]) => onSettingsCommit?.({ featherRadius: value })}
                min={1}
                max={20}
                step={1}
                showTooltip
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {settings.edgeQuality === 'feathered' && 'Higher values create softer edge transitions'}
                {settings.edgeQuality === 'smooth' && 'Higher values apply more anti-aliasing'}
                {settings.edgeQuality === 'refine' && 'Higher values clean up more noise but may lose detail'}
                {settings.edgeQuality === 'decontaminate' && 'Higher values remove more color spill from edges'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Magic Selection Panel
function MagicPanel({ 
  settings, 
  onSettingsChange: _onSettingsChange,
  onSettingsCommit,
  onMagicApply, 
  onMagicCancel, 
  onMagicRegionRemove, 
  onMagicClearAll,
  onMagicApplyAll, 
  onClose 
}: Omit<ToolPanelProps, 'activeTool' | 'onAddColor' | 'onRemoveColor'>) {
  const { magicTolerance, magicPreviewRegion, magicAppliedRegions } = settings;
  const hasPreview = magicPreviewRegion !== null;

  // Local preview state for tolerance slider
  const [previewTolerance, setPreviewTolerance] = React.useState(magicTolerance);
  
  // Sync local state when settings change externally
  React.useEffect(() => {
    setPreviewTolerance(magicTolerance);
  }, [magicTolerance]);

  return (
    <div className="space-y-4">
      <PanelHeader title="Magic Selection" onClose={onClose} />
      
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Click on the image to select connected regions. Choose to include them in the subject or exclude them.
        </p>

        {/* Tolerance Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Tolerance
            </span>
            <span className="text-sm font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md text-gray-600 dark:text-gray-400">
              {previewTolerance}
            </span>
          </div>
          <Slider
            value={[previewTolerance]}
            onValueChange={([value]) => setPreviewTolerance(value)}
            onValueCommit={([value]) => onSettingsCommit?.({ magicTolerance: value })}
            min={1}
            max={100}
            step={1}
            showTooltip
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Higher values select more similar pixels
          </p>
        </div>

        {/* Preview Region Info & Actions */}
        <AnimatePresence>
          {hasPreview && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-4 border-t border-gray-200/60 dark:border-gray-700/60"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#00C4CC]" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Selected Region
                </span>
              </div>

              {/* Region Info Card */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/60">
                <div className="flex items-center gap-3">
                  {/* Color Preview */}
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-white dark:border-gray-600 shadow-sm"
                    style={{
                      backgroundColor: `rgb(${magicPreviewRegion.averageColor.r}, ${magicPreviewRegion.averageColor.g}, ${magicPreviewRegion.averageColor.b})`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {magicPreviewRegion.pixelCount.toLocaleString()} pixels
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {magicPreviewRegion.bounds.width} × {magicPreviewRegion.bounds.height}px
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onMagicApply?.('keep')}
                  className="flex-1 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Keep
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onMagicApply?.('remove')}
                  className="flex-1 gap-1.5 bg-rose-500 hover:bg-rose-600 text-white"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onMagicCancel}
                className="w-full text-gray-500"
              >
                Cancel Selection
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Applied Regions List */}
        {magicAppliedRegions.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Applied Regions
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {magicAppliedRegions.length} region{magicAppliedRegions.length > 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {magicAppliedRegions.map((region) => (
                  <motion.div
                    key={region.id}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="relative group"
                  >
                    <div className={cn(
                      "flex items-center gap-2 p-2 rounded-lg",
                      "bg-gray-50 dark:bg-gray-800/50",
                      "border border-gray-200/60 dark:border-gray-700/60"
                    )}>
                      <div
                        className="w-8 h-8 rounded-md border-2 border-white dark:border-gray-600 shadow-sm"
                        style={{
                          backgroundColor: `rgb(${region.averageColor.r}, ${region.averageColor.g}, ${region.averageColor.b})`,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {region.pixelCount.toLocaleString()} px
                        </div>
                        <div className={cn(
                          "text-xs font-medium",
                          region.mode === 'keep' 
                            ? "text-emerald-600 dark:text-emerald-400" 
                            : "text-rose-600 dark:text-rose-400"
                        )}>
                          {region.mode === 'keep' ? 'Kept' : 'Removed'}
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onMagicRegionRemove?.(region.id)}
                        className={cn(
                          "p-1 rounded-md",
                          "text-gray-400 hover:text-red-500",
                          "hover:bg-red-50 dark:hover:bg-red-900/20",
                          "transition-colors duration-150"
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={onMagicApplyAll}
                className="flex-1 gap-1.5 bg-[#00C4CC] hover:bg-[#00A3A9] text-white"
              >
                <Check className="h-3.5 w-3.5" />
                Apply
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onMagicClearAll}
                className="flex-1 gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Clear All
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main ToolPanel Component
export function ToolPanel({
  className,
  activeTool,
  onClose,
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
}: ToolPanelProps) {
  const renderPanel = () => {
    switch (activeTool) {
      case 'mode':
        return <ModePanel settings={settings} onSettingsChange={onSettingsChange} onSettingsCommit={onSettingsCommit} onClose={onClose} />;
      case 'colors':
        return <ColorsPanel settings={settings} onSettingsChange={onSettingsChange} onSettingsCommit={onSettingsCommit} onAddColor={onAddColor} onRemoveColor={onRemoveColor} onClose={onClose} />;
      case 'edges':
        return <EdgesPanel settings={settings} onSettingsChange={onSettingsChange} onSettingsCommit={onSettingsCommit} onClose={onClose} />;
      case 'magic':
        return <MagicPanel 
          settings={settings} 
          onSettingsChange={onSettingsChange}
          onSettingsCommit={onSettingsCommit}
          onMagicApply={onMagicApply}
          onMagicCancel={onMagicCancel}
          onMagicRegionRemove={onMagicRegionRemove}
          onMagicClearAll={onMagicClearAll}
          onMagicApplyAll={onMagicApplyAll}
          onClose={onClose} 
        />;
      default:
        return null;
    }
  };

  if (!activeTool || activeTool === 'upload') return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -20, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed left-[68px] top-[60px] z-30",
          "w-[320px] max-h-[calc(100vh-80px)]",
          "m-3 p-5",
          "bg-white dark:bg-[hsl(225,15%,11%)]",
          "rounded-2xl",
          "border border-gray-200/60 dark:border-gray-700/60",
          "shadow-xl shadow-black/5 dark:shadow-black/20",
          "overflow-y-auto",
          className
        )}
      >
        {renderPanel()}
      </motion.aside>
    </AnimatePresence>
  );
}

// Keep Sidebar export for backward compatibility
export { ToolPanel as Sidebar };
export default ToolPanel;
