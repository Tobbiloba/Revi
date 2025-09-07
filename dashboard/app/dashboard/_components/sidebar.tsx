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
  Home
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
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
    context: 'global',
  },
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
    <div className="min-[1024px]:block hidden w-56 border-r border-white/10 bg-[#0b0d11] backdrop-blur-xl h-full px-4 relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      
      <div className="flex h-full flex-col relative z-10">
        <div className="flex h-[6rem] items-center mb-2">
          <Link
            prefetch={true}
            className="flex items-center hover:cursor-pointer group transition-all duration-300"
            href="/"
          >
            <Image src="/logo-white.png" width={200} height={200} className="w-16 h-16" alt="logo"/>
          </Link>
        </div>
        
        {/* Show project selector only in global context */}
        {!isProjectContext && <ProjectSelector />}
        
        {/* Show API key section only in project context */}
        {isProjectContext && currentProjectId && <ApiKeySection />}

        <nav className="flex flex-col h-full justify-between items-start w-full space-y-1 mt-6">
          <div className="w-full space-y-2 py-4">
            {navItems.map((item) => (
              <div
                key={item.href}
                onClick={() => router.push(item.href)}
                className={clsx(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-3 text-sm font-light transition-all duration-300 hover:cursor-pointer group relative overflow-hidden",
                  pathname === item.href
                    ? "bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-transparent text-white border border-emerald-500/30 backdrop-blur-sm shadow-lg shadow-emerald-500/10"
                    : "text-gray-300 hover:bg-white/10 hover:text-white hover:backdrop-blur-sm hover:border-white/20 border border-transparent",
                )}
              >
                {/* Active state gradient overlay */}
                {pathname === item.href && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-cyan-400/10 animate-pulse" />
                )}
                
                <item.icon className={clsx(
                  "h-5 w-5 relative z-10 transition-colors duration-300",
                  pathname === item.href 
                    ? "text-emerald-400" 
                    : "text-gray-400 group-hover:text-emerald-400"
                )} strokeWidth={1.5} />
                <span className="relative z-10">{item.label}</span>
                
                {/* Hover gradient effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 transition-opacity duration-300" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 w-full pb-4">
            <div>
              <div
                onClick={() => router.push("/dashboard/settings")}
                className={clsx(
                  "flex items-center gap-3 w-full rounded-lg px-3 py-3 text-sm font-light transition-all duration-300 hover:cursor-pointer group relative overflow-hidden",
                  pathname === "/dashboard/settings"
                    ? "bg-gradient-to-r from-emerald-500/20 via-cyan-500/10 to-transparent text-white border border-emerald-500/30 backdrop-blur-sm shadow-lg shadow-emerald-500/10"
                    : "text-gray-300 hover:bg-white/10 hover:text-white hover:backdrop-blur-sm hover:border-white/20 border border-transparent",
                )}
              >
                {/* Active state gradient overlay */}
                {pathname === "/dashboard/settings" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-cyan-400/10 animate-pulse" />
                )}
                
                <Settings className={clsx(
                  "h-5 w-5 relative z-10 transition-colors duration-300",
                  pathname === "/dashboard/settings" 
                    ? "text-emerald-400" 
                    : "text-gray-400 group-hover:text-emerald-400"
                )} strokeWidth={1.5} />
                <span className="relative z-10">Settings</span>
                
                {/* Hover gradient effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5 transition-opacity duration-300" />
              </div>
            </div>
            <UserProfile />
          </div>
        </nav>
      </div>
    </div>
  );
}
