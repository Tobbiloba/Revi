// src/app/doc/layout.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { allDocs } from 'contentlayer2/generated';
import SearchDialog from './_components/search-dialog';
import { sidebarNav } from '@/config/sidebar';
import Image from 'next/image';
import {
  SidebarProvider,
  SidebarLayout,
  MainContent,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarHeaderTitle,
  UserAvatar,
  NestedLink,
} from './_components/sidebar';
import { Github } from 'lucide-react';

import Header from './_components/header';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Destructure sidebarNav from configDocs
  // const router = useRouter(); // Unused variable
  const isMobile = useIsMobile();
  return (
    <SidebarLayout>
      {/* Left Sidebar Provider */}
      <SidebarProvider
        defaultOpen={isMobile ? false : true}
        defaultSide="left"
        defaultMaxWidth={280}
        showIconsOnCollapse={true}
      >
        <Sidebar>
          <SidebarHeader>
            {/* <SidebarHeaderLogo
              logo={
                <Image src="/logo-white.png" width={200} height={200} className="w-16 h-16" alt="logo"/>
              }
            /> */}

            <Link href={'/'} className="flex flex-1 gap-3">
              <SidebarHeaderTitle>
                <Image src="/logo-white.png" width={200} height={200} className="w-16 h-16" alt="logo"/>
              </SidebarHeaderTitle>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            {sidebarNav.map((section) => (
              <SidebarMenuItem
                isCollapsable={section.pages && section.pages.length > 0}
                key={section.title}
                label={section.title}
                icon={section.icon}
                defaultOpen={section.defaultOpen}
              >
                {section.pages?.map((page) => (
                  <NestedLink key={page.href} href={page.href}>
                    {page.title}
                  </NestedLink>
                ))}
              </SidebarMenuItem>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <UserAvatar>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
            </UserAvatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Revi Team
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                support@revi.dev
              </span>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <MainContent className="bg-[#121418]">
          <Header className="justify-between py-2 px-8 h-20">
            <div className="flex items-center gap-6">
              <SidebarTrigger />
              <div className="flex items-center gap-3">
                {/* <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">R</span>
                </div> */}
                <div>
                  <h1 className="text-xl font-bold text-white">Documentation</h1>
                  <p className="text-sm text-gray-400 -mt-0.5">Learn how to integrate Revi</p>
                </div>
              </div>
            </div>
            <div className="flex gap-4 items-center">
              <div className="relative">
                <SearchDialog searchData={allDocs} />
              </div>
              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>
              <Button
                onClick={() =>
                  window.open('https://github.com/Tobbiloba/Revi', '_blank')
                }
                className="bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium px-6 py-2.5 h-10 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
            </div>
          </Header>
          <main className="overflow-auto p-8 min-h-screen">
            {children}
          </main>
        </MainContent>
      </SidebarProvider>

      {/* Right Sidebar Provider */}
      {/* <SidebarProvider defaultOpen={false} defaultSide="right" defaultMaxWidth={300} showIconsOnCollapse={true}>
        <Sidebar>
          <SidebarHeader>
            <SidebarTrigger />
            <Title>Documentation</Title>
            <BookOpen className="h-5 w-5" />
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem icon={<BookOpen className="h-5 w-5" />} label="Getting Started" href="/docs/getting-started" />
              <SidebarMenuItem icon={<Settings className="h-5 w-5" />} label="Configuration" href="/docs/configuration" />
              <SidebarMenuItem icon={<FileText className="h-5 w-5" />} label="API Reference" defaultOpen={true}>
                <NestedLink href="/docs/api/overview">Overview</NestedLink>
                <NestedLink href="/docs/api/endpoints">Endpoints</NestedLink>
                <NestedLink href="/docs/api/authentication">Authentication</NestedLink>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter>
            <div className="text-sm text-gray-500">v1.0.0</div>
          </SidebarFooter>
        </Sidebar>
      </SidebarProvider> */}
    </SidebarLayout>
  );
}
