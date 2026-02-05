import { Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const themeConfig: Record<Theme, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: "Light mode" },
  dark: { icon: Moon, label: "Dark mode" },
  system: { icon: Monitor, label: "System theme" },
};

const themeOrder: Theme[] = ["light", "dark", "system"];

function getNextTheme(current: Theme): Theme {
  const currentIndex = themeOrder.indexOf(current);
  return themeOrder[(currentIndex + 1) % themeOrder.length];
}

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    setTheme(getNextTheme(theme));
  };

  const { icon: Icon, label } = themeConfig[theme];

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-xl",
        "bg-gray-100 text-gray-600",
        "hover:bg-gray-200 hover:text-gray-900",
        "dark:bg-gray-800 dark:text-gray-400",
        "dark:hover:bg-gray-700 dark:hover:text-gray-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C4CC] focus-visible:ring-offset-2",
        "dark:focus-visible:ring-offset-[hsl(225,15%,10%)]",
        "transition-all duration-200",
        className
      )}
      title={label}
      aria-label={`Current theme: ${label}. Click to change.`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
          transition={{
            duration: 0.2,
            ease: "easeInOut",
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
        </motion.span>
      </AnimatePresence>
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default ThemeToggle;
