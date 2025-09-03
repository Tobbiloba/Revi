"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import UserProfile from "@/components/user-profile";
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

export default function DashboardTopNav({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="flex h-14 lg:h-[52px] items-center gap-4 border-b border-lime-500/20 px-3">
        <Dialog>
          <SheetTrigger className="min-[1024px]:hidden p-2 transition">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <Link prefetch={true} href="/">
                <SheetTitle>Revi Dashboard</SheetTitle>
              </Link>
            </SheetHeader>
            <div className="flex flex-col space-y-3 mt-[1rem]">
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard">
                  <Button variant="outline" className="w-full">
                    <HomeIcon className="mr-2 h-4 w-4" />
                    Overview
                  </Button>
                </Link>
              </DialogClose>
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/projects">
                  <Button variant="outline" className="w-full">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Projects
                  </Button>
                </Link>
              </DialogClose>
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/project/settings">
                  <Button variant="outline" className="w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Project Settings
                  </Button>
                </Link>
              </DialogClose>
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/errors">
                  <Button variant="outline" className="w-full">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Errors
                  </Button>
                </Link>
              </DialogClose>
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/sessions">
                  <Button variant="outline" className="w-full">
                    <Activity className="mr-2 h-4 w-4" />
                    Sessions
                  </Button>
                </Link>
              </DialogClose>
              <Separator className="my-3" />
              <DialogClose asChild>
                <Link prefetch={true} href="/dashboard/settings">
                  <Button variant="outline" className="w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </Link>
              </DialogClose>
            </div>
          </SheetContent>
        </Dialog>
        
        <div className="flex justify-center items-center gap-4 ml-auto">
          <Link href="/dashboard/projects/create">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </Link>
          <ProjectSelector />
          <UserProfile mini={true} />
        </div>
      </header>
      {children}
    </div>
  );
}
