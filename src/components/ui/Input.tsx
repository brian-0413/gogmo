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
          <label className="block text-sm font-medium text-[#222222] mb-1.5">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full px-3 py-2.5 bg-white border border-[#DDDDDD] rounded-lg",
            "text-[#222222] placeholder-[#B0B0B0] text-sm",
            "focus:outline-none focus:border-[#222222] focus:ring-[1px] focus:ring-[#222222]",
            "transition-colors duration-200",
            error && "border-[#E24B4A] focus:border-[#E24B4A] focus:ring-[#E24B4A]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-[#E24B4A]">{error}</p>
        )}
      </div>
    )
  }
)

Input.displayName = "Input"

export { Input }
