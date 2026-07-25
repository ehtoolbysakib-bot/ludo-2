import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-full font-bold transition-all active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-[#1a0533] glow-box hover:brightness-110": variant === 'primary',
            "bg-[#3a2382] text-white hover:bg-[#4a2e9b]": variant === 'secondary',
            "bg-[#FF4444] text-white hover:bg-[#ff6666]": variant === 'danger',
            "bg-transparent text-white hover:bg-white/10": variant === 'ghost',
            "h-9 px-4 text-sm": size === 'sm',
            "h-12 px-8 text-lg": size === 'md',
            "h-16 px-10 text-xl": size === 'lg',
            "h-12 w-12": size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
