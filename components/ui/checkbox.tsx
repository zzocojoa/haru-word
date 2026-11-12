"use client"

import * as React from "react"
import { HaruIcon } from "@/components/icons/haru-icon"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer group/checkbox grid size-4 shrink-0 place-content-center rounded-[4px] text-foreground transition-shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:text-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        forceMount
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <HaruIcon name="checkbox-empty" size={14} className="size-[14px] group-data-[state=checked]/checkbox:hidden group-data-[state=indeterminate]/checkbox:hidden" />
        <HaruIcon name="checkbox-checked" size={14} className="hidden size-[14px] group-data-[state=checked]/checkbox:block group-data-[state=indeterminate]/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
