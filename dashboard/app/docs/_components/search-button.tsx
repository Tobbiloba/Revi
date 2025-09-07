'use client';

import * as React from 'react';
import clsx from 'clsx';
import { Command, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SearchButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  placeholder?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const SearchButton = React.forwardRef<HTMLButtonElement, SearchButtonProps>(
  (
    {
      placeholder = 'Search Documentation..',
      className,
      ...props
    },
    ref
  ) => {
    // Filter out incompatible props
    const { size: _, ...buttonProps } = props;
    
    return (
      <Button
        ref={ref}
        variant={'ghost'}
        className={cn(
          'flex items-center justify-between h-10 px-3 min-w-40 w-80',
          'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          'hover:bg-gray-100 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600',
          'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'transition-all duration-200',
          className
        )}
        {...buttonProps}
      >
        {/* Left section: Search icon and text */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Search size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <span className="text-gray-600 dark:text-gray-300 text-left truncate">
            {placeholder}
          </span>
        </div>
        
        {/* Right section: Keyboard shortcut */}
        <div className="flex items-center ml-2 flex-shrink-0">
          <span
            className={clsx(
              'inline-flex items-center justify-center rounded px-1.5 py-0.5',
              'bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600',
              'text-xs text-gray-600 dark:text-gray-300'
            )}
          >
            <Command size={10} className="mr-0.5" />
            <span>K</span>
          </span>
        </div>
      </Button>
    );
  }
);

SearchButton.displayName = 'SearchButton';

export default SearchButton;