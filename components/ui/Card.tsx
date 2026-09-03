import React, { HTMLAttributes } from 'react';

export type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card: React.FC<CardProps> = ({ className = '', children, ...props }) => {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

export const CardHeader: React.FC<CardHeaderProps> = ({ className = '', children, ...props }) => {
  return (
    <div className={`px-6 py-4 border-b border-gray-100 ${className}`} {...props}>
      {children}
    </div>
  );
};

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const CardTitle: React.FC<CardTitleProps> = ({ className = '', children, ...props }) => {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 leading-none tracking-tight ${className}`} {...props}>
      {children}
    </h3>
  );
};

export type CardContentProps = HTMLAttributes<HTMLDivElement>;

export const CardContent: React.FC<CardContentProps> = ({ className = '', children, ...props }) => {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export const CardFooter: React.FC<CardFooterProps> = ({ className = '', children, ...props }) => {
  return (
    <div className={`px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center ${className}`} {...props}>
      {children}
    </div>
  );
};
