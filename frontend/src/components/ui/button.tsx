"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        primary: "bg-primary text-primary-foreground shadow-meal-primary hover:bg-primary-dark",
        soft: "bg-soft text-muted-foreground hover:bg-border",
        dark: "bg-dark text-white hover:bg-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border bg-card shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        meal: "h-auto min-h-[58px] w-full min-w-0 shrink rounded-meal-button px-4 py-4 text-base leading-normal font-extrabold whitespace-normal wrap-anywhere active:scale-[0.98] motion-reduce:active:scale-100 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled = false,
  children,
  onClickCapture,
  onKeyDownCapture,
  tabIndex,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const blocked = disabled || loading

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      disabled={asChild ? undefined : blocked}
      aria-disabled={blocked ? true : props["aria-disabled"]}
      aria-busy={loading ? true : props["aria-busy"]}
      tabIndex={asChild && blocked ? -1 : tabIndex}
      onClickCapture={(event) => {
        if (asChild && blocked) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        onClickCapture?.(event)
      }}
      onKeyDownCapture={(event) => {
        if (asChild && blocked && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        onKeyDownCapture?.(event)
      }}
    >
      {loading && (
        <svg className="size-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  )
}

export { Button, buttonVariants, type ButtonProps }
