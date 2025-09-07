import { cn } from '@/lib/utils';
import React from 'react';

export function NavMenu({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav className={`relative rounded-lg bg-background ${className}`}>
      {children}
    </nav>
  );
}

export function NavMenuList({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={`flex gap-4 ${className}`} {...props} />;
}

export function NavMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={`relative rounded-lg group ${className}`} {...props} />;
}

export function NavMenuTrigger({
  className,
  ...props
}: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        `cursor-pointer px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted`,
        className
      )}
      {...props}
    />
  );
}

interface NavMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  position?: 'up' | 'down';
}
export function NavMenuContent({
  className,
  position = 'down',
  ...props
}: NavMenuContentProps) {
  return (
    <div
      className={cn(
        `absolute left-0 rounded-lg ${position === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} w-64 border bg-background shadow-lg opacity-0 group-hover:opacity-100 group-hover:visible transition-opacity duration-200`,
        className
      )}
      {...props}
    />
  );
}

export function NavMenuLink({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        `block rounded-lg px-4 py-2 text-sm hover:bg-muted`,
        className
      )}
      {...props}
    />
  );
}

interface NavListItemProps extends React.AnchorHTMLAttributes<HTMLLIElement> {
  href: string;
  title: string;
}
export function NavListItem({ href, title, children }: NavListItemProps) {
  return (
    <li>
      <NavMenuLink href={href}>
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="text-xs text-muted-foreground">{children}</p>
      </NavMenuLink>
    </li>
  );
}

export default function Preview() {
  return (
    <div className="flex gap-8 bg-background p-4">
      <NavMenu>
        <NavMenuList>
          <NavMenuItem>
            <NavMenuTrigger>Getting started</NavMenuTrigger>
            <NavMenuContent position="down">
              <ul className="grid gap-3 p-4 w-64">
                <NavListItem href="/docs" title="Introduction">
                  Overview of components and usage.
                </NavListItem>
                <NavListItem href="/docs/installation" title="Installation">
                  Learn how to install dependencies.
                </NavListItem>
              </ul>
            </NavMenuContent>
          </NavMenuItem>
        </NavMenuList>
      </NavMenu>

      <NavMenu>
        <NavMenuList>
          <NavMenuItem>
            <NavMenuTrigger>Components</NavMenuTrigger>
            <NavMenuContent position="down">
              <ul className="grid gap-3 p-4 w-64">
                <NavListItem href="/components/button" title="Button">
                  Usage of button component.
                </NavListItem>
                <NavListItem href="/components/card" title="Card">
                  Learn how to use cards effectively.
                </NavListItem>
              </ul>
            </NavMenuContent>
          </NavMenuItem>
        </NavMenuList>
      </NavMenu>

      <NavMenu>
        <NavMenuList>
          <NavMenuItem>
            <NavMenuTrigger>Resources</NavMenuTrigger>
            <NavMenuContent position="up">
              <ul className="grid gap-3 p-4 w-64">
                <NavListItem href="/resources/blogs" title="Blogs">
                  Read insightful blogs and tutorials.
                </NavListItem>
                <NavListItem href="/resources/community" title="Community">
                  Join discussions and share knowledge.
                </NavListItem>
              </ul>
            </NavMenuContent>
          </NavMenuItem>
        </NavMenuList>
      </NavMenu>
    </div>
  );
}
