import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, id, ...props }, ref) => {
  const switchId = id || React.useId();

  const switchElement = (
    <SwitchPrimitive.Root
      id={switchId}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        "bg-slate-200 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-600 data-[state=checked]:to-purple-600",
        "dark:bg-slate-700",
        className
      )}
      ref={ref}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
          "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (label) {
    return (
      <div className="flex items-center gap-3">
        {switchElement}
        <label
          htmlFor={switchId}
          className="cursor-pointer text-sm font-medium text-slate-900 dark:text-slate-100"
        >
          {label}
        </label>
      </div>
    );
  }

  return switchElement;
});
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
