'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement> & {
  viewportClassName?: string
}

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, viewportClassName, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="scroll-area"
        className={cn('relative', className)}
        {...props}
      >
        <div
          data-slot="scroll-area-viewport"
          className={cn(
            'h-full w-full overflow-auto rounded-[inherit]',
            'transition-[color,box-shadow] outline-none',
            'focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50',
            viewportClassName
          )}
        >
          {children}
        </div>
      </div>
    )
  }
)
ScrollArea.displayName = 'ScrollArea'

const ScrollBar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="scroll-area-scrollbar"
      className={cn('hidden', className)}
      {...props}
    />
  )
)
ScrollBar.displayName = 'ScrollBar'

export { ScrollArea, ScrollBar }
