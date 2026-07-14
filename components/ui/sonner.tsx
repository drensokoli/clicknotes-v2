"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      position="bottom-right"
      className="toaster group"
      style={
        {
          // Neutral surface + border like the rest of the app's floating
          // panels (dropdown menus, the user menu) - a saturated primary-blue
          // border made the toast read as an alert box instead of matching
          // those. Semantic variants get a light tint in the same family as
          // the status colors used elsewhere (Completed/In Progress/destructive).
          "--normal-bg": "var(--surface-elevated)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.75rem",
          "--success-bg": "var(--surface-elevated)",
          "--success-border": "color-mix(in srgb, #16a34a 35%, var(--border))",
          "--success-text": "#16a34a",
          "--warning-bg": "var(--surface-elevated)",
          "--warning-border": "color-mix(in srgb, #d97706 35%, var(--border))",
          "--warning-text": "#d97706",
          "--error-bg": "var(--surface-elevated)",
          "--error-border": "color-mix(in srgb, #ef4444 35%, var(--border))",
          "--error-text": "#ef4444",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "!shadow-lg",
          actionButton: "!bg-primary !text-white hover:!bg-primary-hover !rounded-lg !px-3 !text-xs !font-medium",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
