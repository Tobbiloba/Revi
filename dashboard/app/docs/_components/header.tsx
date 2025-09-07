import React from 'react';
import { cn } from '@/lib/utils';

const Header: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-[#121418]/95 backdrop-blur-sm shadow-sm',
        className
      )}
      {...props}
    />
  );
};

export default Header;
