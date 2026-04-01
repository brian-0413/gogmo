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
          <label className="block text-sm font-medium text-[#6b6560] mb-1.5">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full px-4 py-3 bg-[#0c0c10] border border-[#1e1e26] rounded-lg",
            "text-[#f0ebe3] placeholder-[#3a3a40]",
            "focus:outline-none focus:border-[#ff6b2b]/50 focus:ring-1 focus:ring-[#ff6b2b]/20",
            "transition-colors duration-200",
            error && "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20",
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
