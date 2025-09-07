'use client';
import { cn } from '@/lib/utils';
import React from 'react';

export const Preview = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      `p-4 h-[330px] justify-items-center content-center rounded-lg border border-border bg-muted text-card-foreground`,
      className
    )}
    ref={ref}
    {...props}
  />
));

Preview.displayName = 'Preview';

export default Preview;
