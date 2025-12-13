import React from 'react';

// --- Card ---
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', noPadding = false, ...props }) => (
  <div className={`bg-white border border-zinc-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 ${noPadding ? '' : 'p-6'} ${className}`} {...props}>
    {children}
  </div>
);

// --- Button ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', className = '', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-red-700 hover:bg-red-800 text-white shadow-md shadow-red-900/10 border border-transparent",
    secondary: "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200",
    danger: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
    ghost: "bg-transparent hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900",
    outline: "bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-300"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// --- Badge ---
export interface BadgeProps {
  children?: React.ReactNode;
  color?: 'zinc' | 'red' | 'green' | 'amber' | 'blue';
}

export const Badge = ({ children, color = 'zinc' }: BadgeProps) => {
  const colors = {
    zinc: "bg-zinc-100 text-zinc-600 border-zinc-200",
    red: "bg-red-50 text-red-600 border-red-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100"
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- Modal ---
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }: ModalProps) => {
  if (!isOpen) return null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`w-full ${sizeClasses[size]} bg-white border border-zinc-200 rounded-xl shadow-2xl animate-fade-in flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50/50 rounded-t-xl">
          <h3 className="text-lg font-bold text-zinc-900 rpg-font">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// --- Input ---
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => (
  <input
    ref={ref}
    className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
    {...props}
  />
));

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>((props, ref) => (
  <select
    ref={ref}
    className="w-full bg-white border border-zinc-300 rounded-md px-3 py-2 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
    {...props}
  >
    {props.children}
  </select>
));