import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
  }

  return (
    <div
      className={cn(
        "inline-block border-[#2d682d]/20 border-t-[#2d682d] rounded-full animate-spin",
        sizeClasses[size],
        className,
      )}
    />
  )
}
