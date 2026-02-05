import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showTooltip?: boolean;
  /** Called continuously while dragging - use for preview UI updates */
  onValueChange?: (value: number[]) => void;
  /** Called only when user releases the slider - use for expensive operations */
  onValueCommit?: (value: number[]) => void;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showTooltip = false, ...props }, ref) => {
  const [showValue, setShowValue] = React.useState(false);
  const value = props.value || props.defaultValue || [0];

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      onPointerDown={() => setShowValue(true)}
      onPointerUp={() => setShowValue(false)}
      onPointerLeave={() => setShowValue(false)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-[#00C4CC] to-[#00A3A9]" />
      </SliderPrimitive.Track>
      {value.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="relative block h-5 w-5 rounded-full border-2 border-[#00C4CC] bg-white shadow-lg shadow-[#00C4CC]/20 transition-all duration-150 hover:scale-110 hover:shadow-[#00C4CC]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C4CC] focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
        >
          {showTooltip && showValue && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
              {value[index]}
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
            </span>
          )}
        </SliderPrimitive.Thumb>
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
