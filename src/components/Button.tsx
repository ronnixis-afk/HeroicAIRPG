import React from 'react';
import { Icon } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
  as?: any;
  [key: string]: any;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  as: Component = 'button',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed gap-2';
  
  const variants: Record<ButtonVariant, string> = {
    primary: 'btn-primary text-black',
    secondary: 'btn-secondary',
    tertiary: 'btn-tertiary',
    danger: 'btn-tertiary text-brand-danger hover:text-red-400',
    ghost: 'text-brand-text-muted hover:text-brand-text hover:bg-white/5',
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
    icon: 'p-2 rounded-icon',
  };

  const combinedClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <Component
      className={combinedClassName}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Icon name="spinner" className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <Icon name={icon} className={size === 'icon' ? 'w-5 h-5' : 'w-4 h-4'} />}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <Icon name={icon} className={size === 'icon' ? 'w-5 h-5' : 'w-4 h-4'} />}
        </>
      )}
    </Component>
  );
};

export default Button;
