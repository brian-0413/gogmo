"use client"

import { forwardRef, ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "danger" | "primary"
  size?: "default" | "sm" | "lg" | "icon"
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", loading, disabled, children, ...props }, ref) => {
    const variants = {
      default: "bg-[#ff6b2b] text-[#060608] hover:bg-[#e85a1a] border-transparent shadow-[0_0_12px_rgba(255,107,43,0.3)]",
      primary: "bg-[#ff6b2b] text-[#060608] hover:bg-[#e85a1a] border-transparent shadow-[0_0_12px_rgba(255,107,43,0.3)]",
      outline: "border border-[#1e1e26] bg-transparent hover:border-[#ff6b2b]/50 hover:text-[#ff6b2b]",
      ghost: "bg-transparent hover:bg-[#141418] text-[#f0ebe3]",
      danger: "bg-[#ef4444] text-white hover:bg-[#dc2626] border-transparent",
    }

    const sizes = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-6 text-base",
      icon: "h-10 w-10",
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-[#ff6b2b] focus:ring-offset-2 focus:ring-offset-[#060608]",
          "disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = "Button"

export { Button }
