import * as React from "react";
import { motion } from "framer-motion";
import {
  Wand2,
  Pipette,
  Layers,
  Settings,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ToolType = "mode" | "colors" | "edges" | "upload" | "magic";

interface ToolRailProps {
  className?: string;
  activeTool: ToolType | null;
  onToolSelect: (tool: ToolType) => void;
  hasImage?: boolean;
}

interface ToolItem {
  id: ToolType;
  icon: React.ElementType;
  label: string;
  description: string;
  requiresImage?: boolean;
}

const tools: ToolItem[] = [
  {
    id: "upload",
    icon: ImageIcon,
    label: "Upload",
    description: "Upload a new image",
  },
  {
    id: "mode",
    icon: Wand2,
    label: "Mode",
    description: "Select removal mode",
    requiresImage: true,
  },
  {
    id: "magic",
    icon: Sparkles,
    label: "Magic",
    description: "Magic selection tool",
    requiresImage: true,
  },
  {
    id: "colors",
    icon: Pipette,
    label: "Colors",
    description: "Pick colors to remove",
    requiresImage: true,
  },
  {
    id: "edges",
    icon: Layers,
    label: "Edges",
    description: "Adjust edge quality",
    requiresImage: true,
  },
];

export function ToolRail({
  className,
  activeTool,
  onToolSelect,
  hasImage = false,
}: ToolRailProps) {
  return (
    <TooltipProvider delayDuration={100}>
      <motion.nav
        initial={{ x: -68, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className={cn(
          "fixed left-0 top-[60px] bottom-0 z-40",
          "w-[68px] py-4",
          "bg-white dark:bg-[hsl(225,15%,10%)]",
          "border-r border-gray-200/60 dark:border-gray-800/60",
          "flex flex-col items-center gap-1",
          className
        )}
      >
        {/* Main Tools */}
        <div className="flex flex-col items-center gap-1 flex-1 w-full px-2">
          {tools.map((tool) => {
            const isDisabled = tool.requiresImage && !hasImage;
            const isActive = activeTool === tool.id;
            const Icon = tool.icon;

            return (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <motion.button
                    whileHover={!isDisabled ? { scale: 1.05 } : undefined}
                    whileTap={!isDisabled ? { scale: 0.95 } : undefined}
                    onClick={() => !isDisabled && onToolSelect(tool.id)}
                    disabled={isDisabled}
                    className={cn(
                      "relative w-full aspect-square max-w-[52px] rounded-xl",
                      "flex flex-col items-center justify-center gap-1",
                      "transition-all duration-200",
                      isActive && [
                        "bg-[#00C4CC]/10 dark:bg-[#00C4CC]/15",
                        "text-[#00C4CC]",
                        "shadow-sm",
                      ],
                      !isActive && !isDisabled && [
                        "text-gray-500 dark:text-gray-400",
                        "hover:bg-gray-100 dark:hover:bg-gray-800",
                        "hover:text-gray-700 dark:hover:text-gray-200",
                      ],
                      isDisabled && [
                        "text-gray-300 dark:text-gray-600",
                        "cursor-not-allowed",
                        "opacity-50",
                      ]
                    )}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeToolIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#00C4CC] rounded-r-full"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                    <span className="text-[10px] font-medium">{tool.label}</span>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p className="font-medium">{tool.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {tool.description}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Bottom Section - Settings */}
        <div className="flex flex-col items-center gap-1 w-full px-2 pt-2 border-t border-gray-200/60 dark:border-gray-800/60">
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "w-full aspect-square max-w-[52px] rounded-xl",
                  "flex flex-col items-center justify-center gap-1",
                  "text-gray-500 dark:text-gray-400",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  "hover:text-gray-700 dark:hover:text-gray-200",
                  "transition-all duration-200"
                )}
              >
                <Settings className="h-5 w-5" strokeWidth={2} />
                <span className="text-[10px] font-medium">Settings</span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p className="font-medium">Settings</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                App preferences
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </motion.nav>
    </TooltipProvider>
  );
}

export default ToolRail;
