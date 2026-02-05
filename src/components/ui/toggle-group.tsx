import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const toggleGroupVariants = cva(
  "inline-flex items-center rounded-xl bg-gray-100 p-1 dark:bg-gray-800/50",
  {
    variants: {
      variant: {
        default: "bg-gray-100 dark:bg-gray-800/50",
        outline: "bg-transparent border border-gray-200 dark:border-gray-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const toggleGroupItemVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C4CC] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "text-gray-600 hover:text-gray-900 data-[state=on]:bg-white data-[state=on]:text-gray-900 data-[state=on]:shadow-sm dark:text-gray-400 dark:hover:text-gray-100 dark:data-[state=on]:bg-gray-700 dark:data-[state=on]:text-gray-100",
        outline:
          "text-gray-600 hover:text-gray-900 hover:bg-gray-100 data-[state=on]:bg-[#00C4CC] data-[state=on]:text-white dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800 dark:data-[state=on]:bg-[#00C4CC]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleGroupVariants>
>({
  variant: "default",
});

type ToggleGroupSingleProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Root
> & {
  type: "single";
};

type ToggleGroupMultipleProps = React.ComponentPropsWithoutRef<
  typeof ToggleGroupPrimitive.Root
> & {
  type: "multiple";
};

export type ToggleGroupProps = (ToggleGroupSingleProps | ToggleGroupMultipleProps) &
  VariantProps<typeof toggleGroupVariants>;

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
>(({ className, variant, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(toggleGroupVariants({ variant }), className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

export interface ToggleGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>,
    VariantProps<typeof toggleGroupItemVariants> {}

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  ToggleGroupItemProps
>(({ className, variant, children, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleGroupItemVariants({ variant: variant || context.variant }),
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
});
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem, toggleGroupVariants, toggleGroupItemVariants };
