"use client"

import { forwardRef, InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = "text", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[#a0a0a0] mb-1.5">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg",
            "text-white placeholder-[#666]",
            "focus:outline-none focus:border-[#ff8c42] focus:ring-1 focus:ring-[#ff8c42]",
            "transition-colors duration-200",
            error && "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[#ef4444]">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
