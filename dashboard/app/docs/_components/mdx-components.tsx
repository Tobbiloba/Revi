'use client';
import React from 'react';
import { useMDXComponent } from 'next-contentlayer2/hooks';
import clsx from 'clsx';
import SearchButton from './search-button';
import Preview from './preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import CustomSyntaxHighlighter from './syntax-highlighter';
import Stepper from './vertical-stepper';
import { Step, Steps, StepTitle, StepContent } from '@/components/ui/step';
import { Button } from '@/components/ui/button';
import { Menu, MenuItem, MenuTrigger, PopMenu } from './menu';
import {
  NavMenu,
  NavMenuItem,
  NavMenuList,
  NavMenuTrigger,
  NavListItem,
  NavMenuContent,
} from './nav-menu';

import {
  PopoverContent,
  PopoverTrigger,
  Popover,
  PopoverClose,
} from '@/components/ui/popover';

import {
  SidebarProvider,
  SidebarLayout,
  MainContent,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeaderLogo,
  SidebarHeaderTitle,
  UserAvatar,
  NestedLink,
} from './sidebar';
import {
  Home,
  Users,
  Settings,
  FileText,
  BarChart,
  Mail,
  Bell,
  BookOpen,
  Component,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  DialogContent,
  DialogTrigger,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogClose,
} from '@/components/ui/dialog';

import { Folder, FolderTree, File } from './folder-tree';
import { Note } from './note';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const components = {
  h1: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <h1
      className={`font-edu text-2xl md:text-3xl font-medium mt-8 mb-6 text-white tracking-tight ${className}`}
      {...children}
    />
  ),
  h2: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    return (
      <Link
        href={`#${props.id}`}
        className={'cursor-pointer group relative items-center w-fit'}
      >
        <h2
          className={`font-edu flex text-xl md:text-2xl font-medium mt-10 mb-4 gap-2 text-white hover:text-blue-400 transition-colors ${className}`}
          {...props}
        >
          {props.children}
          <span className="text-xl text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
            #
          </span>
        </h2>
      </Link>
    );
  },
  h3: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <h3
      className={`font-edu text-lg md:text-xl font-medium mt-8 mb-3 text-gray-200 ${className}`}
      {...children}
    />
  ),
  h4: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <h4
      className={`font-edu text-base md:text-lg font-normal mt-6 mb-2 text-gray-200 ${className}`}
      {...children}
    />
  ),
  p: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <p className={`my-4 text-base leading-relaxed font-normal text-gray-300 max-w-3xl ${className}`} {...children} />
  ),
  a: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <a
      className={`text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-4 decoration-2 hover:decoration-blue-600 transition-all font-medium ${className}`}
      {...children}
    />
  ),
  ul: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <ul className={`list-disc pl-6 my-4 space-y-2 text-base text-gray-300 font-normal max-w-3xl ${className}`} {...children} />
  ),
  ol: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <ol className={`list-decimal pl-6 my-4 space-y-2 text-base text-gray-300 font-normal max-w-3xl ${className}`} {...children} />
  ),
  li: ({ className, ...children }: React.HTMLAttributes<HTMLElement>) => (
    <li className={`leading-relaxed ${className}`} {...children} />
  ),
  blockquote: ({
    className,
    ...children
  }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote
      className={`border-l-4 border-blue-500/40 bg-blue-950/30 pl-6 py-4 my-6 rounded-r-lg backdrop-blur-sm text-base font-normal text-gray-200 italic max-w-3xl ${className}`}
      {...children}
    />
  ),
  hr: ({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className={`my-4 md:my-8 ${className}`} {...props} />
  ),
  table: ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 w-full overflow-x-auto">
      <table
        className={clsx(
          'w-full text-sm border-collapse border rounded-lg outline-1 outline-border outline-offset-[-1px] overflow-hidden',
          className
        )}
        {...props}
      />
    </div>
  ),
  tr: ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr className={clsx('border', className)} {...props} />
  ),
  th: ({ className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className={clsx(
        'border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right',
        className
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      className={clsx(
        'border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right',
        className
      )}
      {...props}
    />
  ),
  code: ({
    className,
    children,
    ...props
  }: React.HTMLAttributes<HTMLElement>) => {
    const isLightMode = 'dark';

    // Extract language from className (e.g., `language-js` → `js`)
    const match = className?.match(/language-(\w+)/);
    const language = match ? match[1] : 'plaintext';

    const extractText = (children: React.ReactNode): string => {
      if (typeof children === 'string') return children;
      if (Array.isArray(children)) return children.map(extractText).join('');
      if (React.isValidElement(children)) {
        const childrenProp = (children.props as Record<string, unknown>)?.children;
        return extractText(childrenProp as React.ReactNode);
      }
      return '';
    };

    if (language !== 'plaintext') {
      return (
        <CustomSyntaxHighlighter
          tabs={{
            [language]: { syntax: extractText(children) as string, language },
          }}
          themeMode={isLightMode}
          indicatorColor="bg-blue-900"
        />
      );
    } else {
      return (
        <code
          className={clsx(
            'relative rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2 py-1 font-mono text-sm text-blue-700 dark:text-blue-300 font-medium',
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }
  },
  // Add your globally available components:
  Preview,
  SearchButton,
  CustomSyntaxHighlighter,
  Tabs,
  TabsList,
  TabsContent,
  TabsTrigger,
  Tab: TabsTrigger,
  Button,
  Step,
  Steps,
  StepTitle,
  StepContent,
  Stepper,
  Checkbox,
  Label,
  Input,
  CodeTabs: ({
    tabs,
  }: React.HTMLAttributes<HTMLElement> & {
    tabs: Record<string, { syntax: string; language: string }>;
  }) => {
    const isLightMode = 'dark';

    return (
      <CustomSyntaxHighlighter
        tabs={tabs}
        themeMode={isLightMode}
        indicatorColor="bg-blue-900"
      />
    );
  },
  SidebarProvider,
  SidebarLayout,
  MainContent,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeaderLogo,
  SidebarHeaderTitle,
  UserAvatar,
  NestedLink,
  Home,
  Users,
  Settings,
  FileText,
  BarChart,
  Mail,
  Bell,
  BookOpen,
  Component,
  Folder,
  FolderTree,
  File,
  Note,
  Menu,
  MenuItem,
  MenuTrigger,
  PopMenu,
  PopoverContent,
  PopoverTrigger,
  Popover,
  PopoverClose,
  NavMenu,
  NavMenuItem,
  NavMenuList,
  NavMenuTrigger,
  NavListItem,
  NavMenuContent,
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  DialogCloseTrigger: DialogClose,
  DialogContent,
  DialogTrigger,
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
};

interface Mdxchildren {
  code: string;
}

export function Mdx({ code }: Mdxchildren) {
  const Component = useMDXComponent(code, {
    style: 'default',
  });

  return (
    <div className="mdx-content space-y-6">
      <Component components={components} />
    </div>
  );
}
