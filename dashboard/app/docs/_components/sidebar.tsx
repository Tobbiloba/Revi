'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import clsx from 'clsx';
import { cn } from '@/lib/utils';

type SidebarContextType = {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  side: 'left' | 'right';
  isMobile: boolean;
  maxWidth: number;
  toggleSidebar: () => void;
  showIconsOnCollapse: boolean;
};

const SidebarContext = React.createContext<SidebarContextType | undefined>(
  undefined
);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  return isMobile;
}

interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  defaultSide?: 'left' | 'right';
  defaultMaxWidth?: number;
  showIconsOnCollapse?: boolean;
  mobileView?: boolean;
}

export function SidebarProvider({
  defaultOpen = true,
  defaultSide = 'left',
  defaultMaxWidth = 280,
  showIconsOnCollapse = true,
  mobileView = true,
  ...props
}: SidebarProviderProps) {
  const useMobile = useIsMobile();

  const isMobile = mobileView ? useMobile : false;

  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [side] = React.useState<'left' | 'right'>(defaultSide);
  const [maxWidth] = React.useState(defaultMaxWidth);

  const toggleSidebar = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Add keyboard shortcut (Ctrl+B) to toggle sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const contextValue = React.useMemo(
    () => ({
      isOpen,
      setIsOpen,
      side,
      isMobile,
      maxWidth,
      toggleSidebar,
      showIconsOnCollapse,
    }),
    [
      isOpen,
      setIsOpen,
      side,
      isMobile,
      maxWidth,
      toggleSidebar,
      showIconsOnCollapse,
    ]
  );

  return <SidebarContext.Provider value={contextValue} {...props} />;
}

// For enabling multiple sidebars in a layout
export function SidebarLayout({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex min-h-screen w-full', className)} {...props} />
  );
}

// Component for main content between sidebars
export function MainContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col h-screen overflow-auto w-full', className)}
      {...props}
    />
  );
}

export function Sidebar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { isOpen, side, isMobile, maxWidth, setIsOpen, showIconsOnCollapse } =
    useSidebar();

  // For mobile: use a fixed overlay when sidebar is open
  if (isMobile) {
    return (
      <>
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}
        <aside
          className={cn(
            `
            fixed top-0 bottom-0 z-50 flex flex-col
            ${side === 'left' ? 'left-0' : 'right-0'}
            ${isOpen ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full'}
            w-[85vw] max-w-[300px] bg-[#0b0d11] 
            ${side === 'left' ? 'border-r' : 'border-l'} border-gray-700
            transition-transform duration-300 ease-in-out
          `,
            className
          )}
          style={{ maxWidth: `${maxWidth}px` }}
          {...props}
        />
      </>
    );
  }

  // For desktop: use a fixed sidebar
  return (
    <aside
      className={clsx(
        `
        sticky top-0 bottom-0 z-0 flex flex-col h-screen
        ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-gray-700
        transition-all duration-300 ease-in-out
        bg-[#0b0d11]
      `,
        className
      )}
      style={{
        minWidth: isOpen ? `${maxWidth}px` : showIconsOnCollapse ? '4rem' : '0',
        width: !isOpen
          ? showIconsOnCollapse
            ? `${maxWidth / 4}px`
            : '0'
          : '0px',
      }}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen, showIconsOnCollapse } = useSidebar();

  // Extract the first child to show as icon when collapsed
  const childrenArray = React.Children.toArray(children);
  const firstChild = childrenArray[0];

  return (
    <div
      className={cn(
        `
        flex items-center h-16 gap-3 ${isOpen ? 'px-6' : 'px-4'} border-gray-700
        ${isOpen ? '' : 'justify-center'}
      `,
        className
      )}
      {...props}
    >
      {isOpen
        ? children
        : showIconsOnCollapse && firstChild
          ? firstChild
          : null}
    </div>
  );
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen, showIconsOnCollapse } = useSidebar();
  return isOpen || showIconsOnCollapse ? (
    <div
      className={cn('flex-1 overflow-auto px-4 py-6', className)}
      {...props}
    />
  ) : null;
}

export function SidebarFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen, showIconsOnCollapse } = useSidebar();

  // Extract the first child to show as icon when collapsed
  const childrenArray = React.Children.toArray(children);
  const firstChild = childrenArray[0];

  return (
    <div
      className={cn(
        `
        flex items-center h-16 border-t gap-3 ${isOpen ? 'px-4' : 'px-4'} border-gray-700
        ${isOpen ? '' : 'justify-center'}
      `,
        className
      )}
      {...props}
    >
      {isOpen
        ? children
        : showIconsOnCollapse && firstChild
          ? firstChild
          : null}
    </div>
  );
}

export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen, showIconsOnCollapse } = useSidebar();
  return isOpen || showIconsOnCollapse ? (
    <nav className={cn('space-y-1', className)} {...props} />
  ) : null;
}

interface SidebarMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  href?: string;
  children?: React.ReactNode;
  isActive?: boolean;
  defaultOpen?: boolean;
  alwaysOpen?: boolean;
  isCollapsable?: boolean;
}

export function SidebarMenuItem({
  icon,
  label,
  href,
  children,
  isActive: propIsActive,
  defaultOpen = false,
  alwaysOpen = false,
  isCollapsable = false,
}: SidebarMenuItemProps) {
  const { isOpen, isMobile, setIsOpen } = useSidebar();
  const [isExpanded, setIsExpanded] = React.useState(defaultOpen || alwaysOpen);
  const pathname = usePathname();

  // Determine if this item is active based on the current path
  const isActive =
    propIsActive !== undefined
      ? propIsActive
      : href
        ? pathname === href || pathname.startsWith(href)
        : false;

  React.useEffect(() => {
    // If alwaysOpen is true, ensure the menu stays open
    if (alwaysOpen) {
      setIsExpanded(true);
    }
  }, [alwaysOpen]);

  const handleClick = (e: React.MouseEvent) => {
    if (children && !href && !alwaysOpen) {
      e.preventDefault();
      setIsExpanded((prev) => !prev);
    }
    // Close the sidebar if in mobile view when a link is clicked
    if (isMobile && href) {
      setIsOpen(false); // Close the sidebar
    }
  };
  const content = (
    <>
      {icon && (
        <span
          className={clsx(
            "h-5 w-5 transition-colors duration-200",
            isActive 
              ? "text-blue-400" 
              : "text-gray-400"
          )}
        >
          {icon}
        </span>
      )}
      {isOpen && (
        <span className={clsx(
          "text-sm transition-colors duration-200",
          isActive 
            ? "text-blue-400 font-medium" 
            : "text-gray-300 font-normal"
        )}>
          {label}
        </span>
      )}
      {isOpen && children && !alwaysOpen && isCollapsable && (
        <span className="ml-auto">
          <ChevronRight
            className={clsx(
              "h-4 w-4 transition-all duration-200",
              isExpanded ? 'rotate-90' : '',
              "text-gray-500"
            )}
          />
        </span>
      )}
    </>
  );

  return (
    <div>
      {href ? (
        <Link
          href={href}
          className={clsx(
            "flex items-center gap-3 w-full rounded-md px-3 py-2 transition-colors duration-200 hover:bg-gray-800",
            isActive
              ? "bg-blue-950/30 border-r-2 border-blue-400"
              : "",
            !isOpen ? 'justify-center' : ''
          )}
          onClick={handleClick}
        >
          {content}
        </Link>
      ) : (
        <button
          className={clsx(
            "flex items-center gap-3 w-full rounded-md px-3 py-2 transition-colors duration-200 hover:bg-gray-800",
            isActive
              ? "bg-blue-950/30 border-r-2 border-blue-400"
              : "",
            !isOpen ? 'justify-center' : ''
          )}
          onClick={handleClick}
        >
          {content}
        </button>
      )}

      {isOpen && (isExpanded || alwaysOpen) && children && (
        <div className="ml-6 mt-1 pl-3 border-l border-gray-200 dark:border-gray-700 space-y-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function NestedLink({
  children,
  href = '#',
  isActive: propIsActive,
}: {
  children: React.ReactNode;
  href?: string;
  isActive?: boolean;
}) {
  const pathname = usePathname();
  const { isMobile, setIsOpen } = useSidebar();

  // Determine if this link is active based on the current path
  const isActive =
    propIsActive !== undefined
      ? propIsActive
      : pathname === href || pathname.startsWith(href);
  const handleClick = () => {
    // Close the sidebar if in mobile view when a link is clicked
    if (isMobile && href) {
      setIsOpen(false); // Close the sidebar
    }
  };
  return (
    <Link
      href={href}
      className={clsx(
        "block py-1.5 px-3 rounded-md text-sm transition-colors duration-200",
        isActive 
          ? 'text-blue-400 bg-blue-950/30 font-medium' 
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
      )}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

export function SidebarTrigger() {
  const { toggleSidebar, side, isOpen } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label="Toggle sidebar"
    >
      {isOpen ? (
        side === 'left' ? (
          <ChevronLeft className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )
      ) : (
        <Menu className="h-5 w-5" />
      )}
    </button>
  );
}

export function SidebarHeaderLogo({
  logo,
  className,
}: {
  logo?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'h-10 w-10 flex items-center justify-center truncate',
        className
      )}
    >
      {logo}
    </div>
  );
}

export function SidebarHeaderTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadElement>) {
  return (
    <h1
      className={cn(
        'text-xl font-semibold text-gray-900 dark:text-white truncate',
        className
      )}
      {...props}
    />
  );
}

export function UserAvatar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'h-8 w-8 rounded-full flex items-center justify-center',
        className
      )}
      {...props}
    />
  );
}
