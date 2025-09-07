"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  HomeIcon,
  AlertTriangle,
  Activity,
  FolderOpen,
  Settings,
  Menu,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { ProjectSelector } from "./project-selector";
import ProfileDropdown from "@/components/proflie";

export default function DashboardTopNav({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col bg-[#121418]">
      <header className="flex h-16 items-center gap-6 border-b border-gray-200 dark:border-gray-800 px-6 shadow-sm">
        <Dialog>
          <SheetTrigger className="min-[1024px]:hidden p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 p-6">
            <SheetHeader className="text-left pb-6">
              <Link prefetch={true} href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="text-xl font-semibold">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-600">
                    Revi
                  </span>
                </div>
                <span className="text-sm text-gray-500 font-light">Dashboard</span>
              </Link>
            </SheetHeader>
            
            <nav className="flex flex-col space-y-2 mt-6">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                Main Navigation
              </div>
              
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard">
                  <Button variant="ghost" className="w-full justify-start h-11 px-3 font-normal">
                    <HomeIcon className="mr-3 h-4 w-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">Overview</span>
                  </Button>
                </Link>
              </DialogClose>
              
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/projects">
                  <Button variant="ghost" className="w-full justify-start h-11 px-3 font-normal">
                    <FolderOpen className="mr-3 h-4 w-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">Projects</span>
                  </Button>
                </Link>
              </DialogClose>
              
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 mt-6">
                Project Tools
              </div>
              
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/errors">
                  <Button variant="ghost" className="w-full justify-start h-11 px-3 font-normal">
                    <AlertTriangle className="mr-3 h-4 w-4 text-red-500" />
                    <span className="text-gray-700 dark:text-gray-300">Errors</span>
                  </Button>
                </Link>
              </DialogClose>
              
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/sessions">
                  <Button variant="ghost" className="w-full justify-start h-11 px-3 font-normal">
                    <Activity className="mr-3 h-4 w-4 text-blue-500" />
                    <span className="text-gray-700 dark:text-gray-300">Sessions</span>
                  </Button>
                </Link>
              </DialogClose>
              
              <Separator className="my-4" />
              
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/settings">
                  <Button variant="ghost" className="w-full justify-start h-11 px-3 font-normal">
                    <Settings className="mr-3 h-4 w-4 text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">Settings</span>
                  </Button>
                </Link>
              </DialogClose>
            </nav>
          </SheetContent>
        </Dialog>
        
        <div className="flex items-center gap-4 ml-auto">
          <Link href="/dashboard/projects/create">
            <Button 
              variant="outline" 
              size="sm"
              className="h-9 px-3 font-normal border-gray-200 dark:border-gray-700 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2 text-emerald-600" />
              <span className="text-gray-700 dark:text-gray-300">Create Project</span>
            </Button>
          </Link>
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <ProjectSelector />
          <ProfileDropdown />
        </div>
      </header>
      {children}
    </div>
  );
}
