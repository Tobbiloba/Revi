"use client";

import UserProfile from "@/components/user-profile";
import clsx from "clsx";
import {
  HomeIcon,
  LucideIcon,
  Settings,
  AlertTriangle,
  Activity,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ProjectSelector } from "./project-selector";
import { ApiKeySection } from "./api-key-section";
import { useNavigationContext } from "@/lib/hooks/useNavigationContext";
import Image from "next/image";
interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  context?: 'global' | 'project' | 'both';
}

const globalNavItems: NavItem[] = [
  {
    label: "Projects",
    href: "/dashboard/projects",
    icon: FolderOpen,
    context: 'global',
  },
];

const getProjectNavItems = (projectId: number): NavItem[] => [
  {
    label: "Overview", 
    href: `/dashboard/projects/${projectId}/dashboard`,
    icon: HomeIcon,
    context: 'project',
  },
  {
    label: "Errors",
    href: `/dashboard/projects/${projectId}/errors`,
    icon: AlertTriangle,
    context: 'project',
  },
  {
    label: "Sessions",
    href: `/dashboard/projects/${projectId}/sessions`,
    icon: Activity,
    context: 'project',
  },
];

export default function DashboardSideBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isProjectContext, currentProjectId } = useNavigationContext();

  // Determine which navigation items to show based on context
  const navItems = isProjectContext && currentProjectId 
    ? getProjectNavItems(currentProjectId) 
    : globalNavItems;

  return (
    <div className="min-[1024px]:block hidden w-56 border-r border-lime-500/20 h-full px-4">
      <div className="flex h-full flex-col">
        <div className="flex h-[6rem] items-center mb-2">
          <Link
            prefetch={true}
            className="flex items-center bg-white/10 border border-white/40 rounded-md hover:cursor-pointer"
            href="/"
          >
            <Image src="/logo.png" width={400} height={400} alt="logo" className="w-12 h-12"/>
          </Link>
        </div>
        
        {/* Show project selector only in global context */}
        {!isProjectContext && <ProjectSelector />}
        
        {/* Show API key section only in project context */}
        {isProjectContext && currentProjectId && <ApiKeySection />}

        <nav className="flex flex-col h-full justify-between items-start w-full space-y-1 mt-6">
          <div className="w-full space-y-1 py-4">
            {navItems.map((item) => (
              <div
                key={item.href}
                onClick={() => router.push(item.href)}
                className={clsx(
                  "flex items-center gap-2 w-full rounded-lg px-3 py-3 text-sm font-[300] transition-colors hover:cursor-pointer",
                  pathname === item.href
                    ? "bg-lime-600/20 text-lime-300 hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-5 w-5" strokeWidth={1} />
                {item.label}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 w-full">
            <div className="">
              <div
                onClick={() => router.push("/dashboard/settings")}
                className={clsx(
                  "flex items-center w-full gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:cursor-pointer",
                  pathname === "/dashboard/settings"
                    ? "bg-lime-600/20 text-lime-300 hover:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </div>
            </div>
            <UserProfile />
          </div>
        </nav>
      </div>
    </div>
  );
}
