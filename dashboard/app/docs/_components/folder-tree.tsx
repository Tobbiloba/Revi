'use client';

import type React from 'react';
import { createContext, useContext, useState } from 'react';
import { cn } from '@/lib/utils';
import { FolderClosed, FolderOpen, LucideFileText } from 'lucide-react';

type FolderTreeContextType = {
  indentSize: number;
};

const FolderTreeContext = createContext<FolderTreeContextType>({
  indentSize: 16,
});

export function FolderTree({
  children,
  className,
  indentSize = 16,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  indentSize?: number;
}) {
  return (
    <FolderTreeContext.Provider value={{ indentSize }}>
      <div
        className={cn('text-sm border rounded-lg broder-b', className)}
        {...props}
      >
        {children}
      </div>
    </FolderTreeContext.Provider>
  );
}

export function Folder({
  children,
  element,
  defaultOpen = true,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  element: string;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { indentSize } = useContext(FolderTreeContext);

  return (
    <div className={cn('select-none', className)} {...props}>
      <FolderLabel
        name={element}
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <div
          className="pl-4 border-l border-border dark:border-border ml-2 mt-1"
          style={{ marginLeft: indentSize / 2 }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function File({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('select-none', className)} {...props}>
      <FileLabel>{children}</FileLabel>
    </div>
  );
}

function FolderLabel({
  name,
  isOpen,
  onClick,
}: {
  name: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/50 cursor-pointer"
      onClick={onClick}
    >
      <FolderIcon isOpen={isOpen} />
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}

function FileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 py-1 px-2 rounded-md hover:bg-muted/50">
      <FileIcon />
      <span className="text-sm">{children}</span>
    </div>
  );
}

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="w-4 h-4 flex items-center justify-center">
      {isOpen ? <FolderOpen /> : <FolderClosed />}
    </div>
  );
}

function FileIcon({ className }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('w-4 h-4 flex items-center justify-center', className)}>
      <LucideFileText />
    </div>
  );
}
