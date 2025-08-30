import * as React from "react"
import { cn } from "../../lib/utils"

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const scrollPositionRef = React.useRef<number>(0)

  // React.useEffect(() => {
  //   if (open) {
  //     // ダイアログが開く時にスクロール位置を保存
  //     scrollPositionRef.current = window.scrollY
  //   } else {
  //     // ダイアログが閉じる時にスクロール位置を復元
  //     window.scrollTo(0, scrollPositionRef.current)
  //   }
  // }, [open]) // 一時的に無効化

  if (!open) return null

  return (
    <div 
      className="fixed mobile-dialog-overlay" 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 999999,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        margin: 0,
        padding: 0
      }}
    >
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        style={{ zIndex: 999998 }}
      />
      <div 
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto mobile-dialog-content"
        style={{ zIndex: 999999 }}
      >
        {children}
      </div>
    </div>
  )
}

interface DialogContentProps {
  className?: string
  children: React.ReactNode
}

export function DialogContent({ className, children }: DialogContentProps) {
  return (
    <div className={cn(
      "bg-white border border-border rounded-lg shadow-lg p-4 md:p-6 w-full",
      className
    )}>
      {children}
    </div>
  )
}

interface DialogHeaderProps {
  children: React.ReactNode
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return (
    <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
      {children}
    </div>
  )
}

interface DialogTitleProps {
  children: React.ReactNode
}

export function DialogTitle({ children }: DialogTitleProps) {
  return (
    <h3 className="text-lg font-semibold text-foreground">
      {children}
    </h3>
  )
}

interface DialogDescriptionProps {
  children: React.ReactNode
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return (
    <p className="text-sm text-muted-foreground">
      {children}
    </p>
  )
}