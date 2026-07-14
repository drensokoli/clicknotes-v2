"use client"

import { useEffect } from "react"
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion"
import { X } from "lucide-react"

// Shared bottom-sheet shell - used by the Library page's Filters/Sort drawers
// (components/library-filters.tsx) and Home's search filter bar
// (components/search-filter-bar.tsx). Dragging the handle down past a
// threshold (or with enough velocity) closes it, like a native sheet. Drag is
// scoped to the handle (dragListener={false} + onPointerDown starting
// dragControls) so scrolling the content below it doesn't also drag the
// sheet. Blocks the page behind it from scrolling while open.
export function MobileDrawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const dragControls = useDragControls()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = "unset"
      }
    }
  }, [open])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl shadow-2xl p-5 max-h-[80vh] overflow-y-auto"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border cursor-grab active:cursor-grabbing touch-none"
            />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
