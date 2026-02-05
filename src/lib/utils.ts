import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 * - clsx: Handles conditional classes and arrays
 * - twMerge: Merges Tailwind classes intelligently (handles conflicts)
 *
 * @example
 * cn("px-2 py-1", "px-4") // "py-1 px-4" - px-4 overrides px-2
 * cn("text-red-500", condition && "text-blue-500")
 * cn(["base-class", "another-class"], { "conditional-class": isActive })
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
