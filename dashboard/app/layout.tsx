import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { ThemeProvider, QueryProvider } from "../components/provider";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import ErrorBoundary from "@/components/error-boundary";
import { NotificationProvider } from "@/components/ui/notification-provider";
export const metadata: Metadata = {
  title: "Revi - Error Monitoring & Session Replay",
  description:
    "Modern error monitoring and session replay platform. Track, analyze, and resolve issues faster with real-time insights and comprehensive debugging tools.",
  openGraph: {
    title: "Next.js Starter Kit",
    description:
      "A modern, full-stack Next.js starter kit with authentication, payments, and dashboard. Built with TypeScript, Tailwind CSS, and shadcn/ui.",
    url: "nextstarter.xyz",
    siteName: "Next.js Starter Kit",
    images: [
      {
        url: "https://jdj14ctwppwprnqu.public.blob.vercel-storage.com/nsk-w9fFwBBmLDLxrB896I4xqngTUEEovS.png",
        width: 1200,
        height: 630,
        alt: "Next.js Starter Kit",
      },
    ],
    locale: "en-US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-neue-montreal antialiased bg-black text-white">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            forcedTheme="light"
            disableTransitionOnChange
          >
            <NotificationProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
              <Toaster />
              <Analytics />
            </NotificationProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
