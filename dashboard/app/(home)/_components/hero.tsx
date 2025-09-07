"use client";
import React from 'react'
import Wrapper from '@/components/global/wrapper';
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import Container from '@/components/global/container';
import { CodeBlock } from "@/components/ui/code-block";
const featureCards = [
    {
        title: "Real-time Error Tracking",
        description: "Catch and resolve errors before they impact users with intelligent monitoring",
        icon: "🔍",
        anchor: "#error-tracking",
    },
    {
        title: "Session Replay",
        description: "See exactly what users experienced when errors occurred",
        icon: "📹",
        anchor: "#session-replay",
    },
    {
        title: "Performance Monitoring",
        description: "Track Core Web Vitals and optimize user experience automatically",
        icon: "⚡",
        anchor: "#performance-monitoring",
    },
];

export function CodeBlockDemoSecond() {
    // 3️⃣ Provider logic
    const ReviProviderCode = `import "./globals.css";
import Navigation from "@/components/Navigation";
import ReviProvider from "@/components/ReviProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={'antialiased'}
      >
        <ReviProvider>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main>
              {children}
            </main>
          </div>
        </ReviProvider>
      </body>
    </html>
  );
}

`;
    const RevMonitor = `'use client';
import { Monitor } from 'revi-monitor';

// Initialize monitor directly
export const monitor = new Monitor({
  apiKey: 'revi_*****',
  apiUrl: 'http://127.0.0.1:4000',
  environment: 'development',
  debug: true,
  sampleRate: 1.0,
  sessionSampleRate: 1.0,
  privacy: {
    maskInputs: true,
    maskPasswords: true,
    maskCreditCards: true
  },
  performance: {
    captureWebVitals: true,
    captureResourceTiming: false,
    captureNavigationTiming: true
  },
  replay: {
    enabled: true,
    maskAllInputs: false,
    maskAllText: false
  }
});
`
    // 4️⃣ Wrapper usage
    const ReviWrapperCode = `'use client';
import { createContext, useContext, ReactNode } from 'react';
import { monitor } from './reviMonitor';

const ReviContext = createContext(monitor);

export const useRevi = () => {
  const monitor = useContext(ReviContext);
  return { monitor };
};

interface ReviProviderProps {
  children: ReactNode;
}

const ReviProvider = ({ children }: ReviProviderProps) => {
  // Expose monitor to global window
  if (typeof window !== 'undefined') {
    (window as any).Revi = monitor;
  }

  return (
    <ReviContext.Provider value={monitor}>
      {children}
    </ReviContext.Provider>
  );
}
export default ReviProvider;
`;

    return (
        <div className="max-w-3xl mx-auto w-full">
            <CodeBlock
                language="tsx"
                filename="CodeDemo.tsx"
                tabs={[
                    { name: "Layout.tsx", code: ReviProviderCode, language: "tsx" },
                    { name: "RevMonitor.tsx", code: RevMonitor, language: "tsx" },
                    { name: "ReviProvider.tsx", code: ReviWrapperCode, language: "tsx" }
                ]}
            />
        </div>
    );
}



const Hero = () => {
    const handleFeatureClick = (anchor: string) => {
        const element = document.querySelector(anchor);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };
    return (
        <div className="relative min-h-screen w-full bg-gradient-to-br from-black via-neutral-900 to-black overflow-hidden">
            {/* Modern gradient background overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/30 z-0" />

            {/* Subtle geometric pattern overlay */}
            <div className="absolute inset-0 opacity-5 z-0"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
            />

            <Image
                src="/hero.svg"
                alt="Revi error monitoring platform background design"
                width={1024}
                height={1624}
                className="absolute inset-x-0 -top-16 w-full z-0 min-w-full opacity-80"
                priority={true}
                loading="eager"
            />

            <Wrapper className="relative z-10 min-h-screen flex items-center py-16 sm:py-20 lg:py-32 max-w-7xl">
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center">
                    {/* Left Content Section */}
                    <div className="lg:col-span-6 space-y-6 sm:space-y-8">
                        {/* Brand Badge */}
                        <Container>
                            <div className="inline-flex items-center gap-x-2 px-3 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-normal text-white/90">
                                    Revi Platform
                                </span>
                            </div>
                        </Container>

                        {/* Main Headline */}
                        <Container delay={0.1}>
                            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-6xl xl:text-6xl font-normal text-white leading-[1.2] tracking-tight">
                                Debug <span className=''>faster</span>.
                                <span className="edu block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mt-1">
                                    Ship with confidence.
                                </span>
                            </h1>
                            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-light text-white/80 mt-2 leading-[1.4]">
                                Real-time error monitoring and session replay for modern applications.
                            </h2>
                        </Container>

                        {/* Description */}
                        <Container delay={0.2}>
                            <div className="space-y-3 max-w-xl">
                                <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light">
                                    Stop losing sleep over production bugs. Revi captures every error, records user sessions, and provides the context you need to fix issues fast.
                                </p>
                                <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light">
                                    From React apps to Node.js APIs, <span className="text-emerald-400 font-normal">see exactly what happened</span> when your users encountered problems.
                                </p>
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 pt-4">
                                    <div className="flex flex-col items-center sm:items-start">
                                        <span className="text-emerald-400 font-medium text-sm sm:text-base">99.9%</span>
                                        <span className="text-white/60 text-xs font-light text-center sm:text-left">Error Detection</span>
                                    </div>
                                    <div className="flex flex-col items-center sm:items-start">
                                        <span className="text-emerald-400 font-medium text-sm sm:text-base">&lt;50ms</span>
                                        <span className="text-white/60 text-xs font-light text-center sm:text-left">Overhead Impact</span>
                                    </div>
                                    <div className="flex flex-col items-center sm:items-start">
                                        <span className="text-emerald-400 font-medium text-sm sm:text-base">100%</span>
                                        <span className="text-white/60 text-xs font-light text-center sm:text-left">Session Capture</span>
                                    </div>
                                    <div className="flex flex-col items-center sm:items-start">
                                        <span className="text-emerald-400 font-medium text-sm sm:text-base">24/7</span>
                                        <span className="text-white/60 text-xs font-light text-center sm:text-left">Monitoring</span>
                                    </div>
                                </div>
                            </div>
                        </Container>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-6 sm:pt-8">
                            {featureCards.map((card, index) => (
                                <Card
                                    key={index}
                                    className={`cursor-pointer hover:bg-white/15 bg-white/10 transition-colors border-white/20 ${index === 0 ? "sm:col-span-2" : ""}`}
                                    onClick={() => handleFeatureClick(card.anchor)}
                                >
                                    <CardContent className="px-3 sm:px-4 text-white">
                                        <div className="flex items-start space-x-3">
                                            <div className="text-base sm:text-lg flex-shrink-0">{card.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-xs sm:text-sm mb-1 text-white">{card.title}</h3>
                                                <p className="text-[10px] sm:text-xs text-white/60 leading-relaxed">
                                                    {card.description}
                                                </p>
                                            </div>
                                            <ChevronRight className="h-3 w-3 text-white/40 flex-shrink-0" />
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                    </div>

                    {/* Right Code/Demo Section */}
                    <div className="lg:col-span-6 mt-6 sm:mt-8 lg:mt-0">
                        <Container delay={0.4}>
                            <CodeBlockDemoSecond />
                        </Container>
                    </div>
                </div>
            </Wrapper>
        </div>
    )
};

export default Hero
