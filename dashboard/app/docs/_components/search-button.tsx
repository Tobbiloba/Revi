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

// Size mapping - currently unused but kept for future extensibility
// const sizeMapping = {
//   xs: {
//     button: 'py-1 px-2 text-xs',
//     icon: 'px-1',
//     iconSize: 11,
//   },
//   sm: {
//     button: 'py-1.5 px-3 text-sm',
//     icon: 'px-1',
//     iconSize: 11,
//   },
//   md: {
//     button: 'py-2 px-4 text-base',
//     icon: 'px-1',
//     iconSize: 13,
//   },
//   lg: {
//     button: 'py-3 px-6 text-lg',
//     icon: 'px-2',
//     iconSize: 14,
//   },
//   xl: {
//     button: 'py-4 px-8 text-xl',
//     icon: 'px-2',
//     iconSize: 15,
//   },
// };

const SearchButton = React.forwardRef<HTMLButtonElement, SearchButtonProps>(
  (
    {
      placeholder = 'Search Documentation..',
      size = 'sm',
      className,
      ...props
    },
    ref
  ) => {
    // const { icon, iconSize } = sizeMapping[size]; // Unused variables
    return (
      <Button
        ref={ref}
        variant={'ghost'}
        className={cn(
          'flex flex-1 justify-start space-x-3 h-10 px-4',
          'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
          'hover:bg-gray-100 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600',
          'focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
          'transition-all duration-200',
          className
        )}
        {...props}
      >
        <Search size={16} className="text-gray-500 dark:text-gray-400" />
        <span className="text-gray-600 dark:text-gray-300 flex-1 text-left">{placeholder}</span>
        <div className="flex items-center gap-1">
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
