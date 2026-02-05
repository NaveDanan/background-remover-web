import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pipette, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

export interface ColorItem {
  id: string;
  hex: string;
  r: number;
  g: number;
  b: number;
  tolerance: number;
}

interface ColorListProps {
  colors: ColorItem[];
  onColorUpdate: (id: string, updates: Partial<ColorItem>) => void;
  onColorRemove: (id: string) => void;
  onColorAdd?: (color: Omit<ColorItem, "id" | "tolerance">) => void;
  className?: string;
}

export function ColorList({
  colors,
  onColorUpdate,
  onColorRemove,
  onColorAdd,
  className,
}: ColorListProps) {
  const [showColorInput, setShowColorInput] = React.useState(false);
  const colorInputRef = React.useRef<HTMLInputElement>(null);

  const handleColorInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onColorAdd) return;

      const hex = e.target.value.toUpperCase();
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      onColorAdd({ hex, r, g, b });
      setShowColorInput(false);
    },
    [onColorAdd]
  );

  const handleAddClick = React.useCallback(() => {
    setShowColorInput(true);
    // Focus the color input after it appears
    setTimeout(() => {
      colorInputRef.current?.click();
    }, 100);
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Colors to Remove
        </h3>
        {onColorAdd && (
          <button
            type="button"
            onClick={handleAddClick}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>

      {/* Hidden color input */}
      {showColorInput && (
        <input
          ref={colorInputRef}
          type="color"
          className="absolute h-0 w-0 opacity-0"
          onChange={handleColorInputChange}
          onBlur={() => setShowColorInput(false)}
        />
      )}

      {/* Empty state */}
      {colors.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 p-6 dark:border-slate-700"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Pipette className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </div>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Click on the image to select colors to remove
          </p>
        </motion.div>
      )}

      {/* Color list */}
      <AnimatePresence mode="popLayout">
        {colors.map((color) => (
          <ColorListItem
            key={color.id}
            color={color}
            onUpdate={(updates) => onColorUpdate(color.id, updates)}
            onRemove={() => onColorRemove(color.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface ColorListItemProps {
  color: ColorItem;
  onUpdate: (updates: Partial<ColorItem>) => void;
  onRemove: () => void;
}

function ColorListItem({ color, onUpdate, onRemove }: ColorListItemProps) {
  const handleToleranceChange = React.useCallback(
    (value: number[]) => {
      onUpdate({ tolerance: value[0] });
    },
    [onUpdate]
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{
        layout: { duration: 0.2 },
        opacity: { duration: 0.15 },
        scale: { duration: 0.15 },
      }}
      className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50"
    >
      <div className="flex items-center gap-3">
        {/* Color swatch */}
        <div
          className="h-8 w-8 shrink-0 rounded-full border-2 border-white shadow-md dark:border-slate-700"
          style={{ backgroundColor: color.hex }}
          title={color.hex}
        />

        {/* Color info and controls */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-sm font-medium text-slate-700 dark:text-slate-200">
              {color.hex}
            </span>
            <button
              type="button"
              onClick={onRemove}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
                "text-slate-400 hover:bg-red-100 hover:text-red-500",
                "dark:hover:bg-red-900/30 dark:hover:text-red-400"
              )}
              aria-label={`Remove color ${color.hex}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tolerance slider */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 w-14 shrink-0">
              Tolerance
            </span>
            <Slider
              value={[color.tolerance]}
              onValueChange={handleToleranceChange}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="w-8 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
              {color.tolerance}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default ColorList;
