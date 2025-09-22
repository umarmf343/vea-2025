"use client"

import * as React from "react"

import { Youtube } from "lucide-react"

import { cn } from "@/lib/utils"

interface TutorialLinkProps extends React.ComponentPropsWithoutRef<"a"> {
  href: string
  label?: string
  variant?: "default" | "inverse"
}

export function TutorialLink({
  href,
  label = "Tutorial",
  variant = "default",
  className,
  children,
  ...props
}: TutorialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variant === "inverse"
          ? "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70 focus-visible:ring-offset-transparent"
          : "border border-[#2d682d]/20 bg-[#2d682d]/10 text-[#1f4a1f] hover:bg-[#2d682d]/20 focus-visible:ring-[#2d682d]/40 focus-visible:ring-offset-white",
        className,
      )}
      {...props}
    >
      <Youtube className="h-4 w-4" />
      {children ?? label}
    </a>
  )
}

export default TutorialLink
