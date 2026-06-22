import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, type = 'text', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={`w-full bg-[#0d1222] border ${error ? 'border-rose-500/70 focus:border-rose-500 focus:ring-rose-500/30' : 'border-white/10 focus:border-indigo-500 focus:ring-indigo-500/30'} rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all duration-200 ${className}`}
          {...props}
        />
        {error && (
          <span className="text-[11px] font-medium text-rose-400">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
