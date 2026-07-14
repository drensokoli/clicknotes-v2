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
          "--normal-bg": "var(--surface-elevated)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--primary)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          icon: "text-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
