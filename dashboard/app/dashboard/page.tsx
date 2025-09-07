
'use client';

import { RealTimeErrorStream } from '@/app/dashboard/_components/advanced/real-time-error-stream';
import { InteractiveErrorTimeline } from '@/app/dashboard/_components/advanced/interactive-error-timeline';
import { ErrorHeatMaps } from '@/app/dashboard/_components/advanced/error-heat-maps';
import { UserJourneyVisualization } from '@/app/dashboard/_components/advanced/user-journey-visualization';
import { ErrorGroupingView } from '@/app/dashboard/errors/_components/error-grouping-view';
import { ProjectsOverview } from "./_components/projects-overview";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconFlask, IconBolt, IconActivity, IconEye, IconBrain } from '@tabler/icons-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRealTimeErrors } from '@/lib/hooks/useRealTimeErrors';

export default function Dashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState<number>(1);

  // Get real-time errors for the interactive timeline
  const { errors, isConnected } = useRealTimeErrors({
    projectId: selectedProjectId,
    maxErrors: 500,
    filters: {},
    enableNotifications: false
  });

  const handleErrorClick = (error: { message: string }) => {
    toast.info(`Clicked error: ${error.message.substring(0, 50)}...`);
  };

  const generateMockError = () => {
    // This would simulate creating a test error in development
    toast.success('Mock error generation would be implemented with backend integration');
  };

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border-gray-200 dark:border-gray-700">
              <div className={`size-2 rounded-full animate-pulse ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="font-normal">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </Badge>
          </div>
        </div>

      {/* Projects Overview */}
      <ProjectsOverview />

        {/* Feature Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/40 dark:hover:bg-gray-800/40">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <IconBolt className="size-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">Real-time Stream</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
                Live error monitoring with WebSocket connections, filtering, and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-gray-700 dark:text-gray-300 font-light">Live WebSocket connection</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 bg-blue-500 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300 font-light">Smart filtering & aggregation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 bg-purple-500 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300 font-light">Browser notifications</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/40 dark:hover:bg-gray-800/40">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <IconActivity className="size-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">Interactive Timeline</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
                Zoomable error timeline with correlation analysis and anomaly detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-gray-700 dark:text-gray-300 font-light">
                D3.js powered timeline visualization with drag-to-zoom capabilities
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/40 dark:hover:bg-gray-800/40">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <IconEye className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">User Journey Maps</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
                Visualize user flows and identify error injection points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-gray-700 dark:text-gray-300 font-light">
                Sankey diagrams and funnel analysis with real database data
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/40 dark:hover:bg-gray-800/40 md:col-span-2 xl:col-span-1">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl font-normal">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <IconBrain className="size-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-gray-800 dark:text-gray-200">Smart Error Grouping</span>
              </CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
                AI-powered error clustering and similarity detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-2 bg-purple-500 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300 font-light">Intelligent error fingerprinting</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 bg-indigo-500 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300 font-light">Pattern-based grouping algorithms</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="size-2 bg-pink-500 rounded-full" />
                  <span className="text-gray-700 dark:text-gray-300 font-light">Similarity scoring and merge suggestions</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Demo Controls */}
        <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-xl font-normal">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <IconFlask className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-gray-800 dark:text-gray-200">Demo Controls</span>
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400 text-base font-light">
              Test the real-time error stream with mock data
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Button 
              onClick={generateMockError} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 font-normal px-6"
            >
              <IconFlask className="size-4 mr-2" />
              Generate Mock Error
            </Button>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <div className={`size-2 rounded-full animate-pulse ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="font-light">WebSocket server: {isConnected ? 'Connected' : 'Connecting...'}</span>
            </div>
          </CardContent>
        </Card>

      {/* Error Grouping & Similarity Analysis */}
      <ErrorGroupingView
        errors={errors}
        onGroupMerge={(groupIds) => {
          toast.info(`Merging ${groupIds.length} error groups...`);
          // Implement group merge logic
        }}
        className="col-span-full"
      />

      {/* Interactive Error Timeline */}
      <InteractiveErrorTimeline
        errors={errors}
        onErrorClick={handleErrorClick}
        enableZoom={true}
        enableBrushing={true}
        height={400}
        className="col-span-full"
      />

      {/* Error Heat Maps */}
      <ErrorHeatMaps
        errors={errors}
        height={400}
        className="col-span-full"
      />

      {/* User Journey Visualization */}
      <UserJourneyVisualization
        errors={errors}
        height={500}
        className="col-span-full"
      />

      {/* Real-time Error Stream */}
      <RealTimeErrorStream
        projectId={selectedProjectId}
        enableSound={true}
        enableFilters={true}
        onErrorClick={handleErrorClick}
        className="col-span-full"
      />

      {/* Implementation Status */}
      <Card className="bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl font-normal">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <IconActivity className="size-6 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-gray-800 dark:text-gray-200">Implementation Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-normal text-emerald-700 dark:text-emerald-400 text-lg">
                  <div className="size-2 bg-emerald-500 rounded-full"></div>
                  Completed Features
                </h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 font-light">
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> WebSocket server with Socket.IO integration</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Real-time error streaming and notifications</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Interactive error timeline with D3.js</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Zoomable timeline with drag-to-pan</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Error heat maps (time, location, browser/OS)</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> User journey visualization with Sankey diagrams</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Real database integration (no mock data)</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Multi-dimensional error analytics</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Time range selection and filtering</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Error grouping and visualization</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Error filtering and search</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Browser notifications</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Connection status indicators</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-1">•</span> Pause/resume functionality</li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 font-normal text-blue-700 dark:text-blue-400 text-lg">
                  <div className={`size-2 rounded-full animate-pulse ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  Active Features
                </h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300 font-light">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span> 
                    Live WebSocket connection: {isConnected ? 
                      <span className="text-emerald-600 dark:text-emerald-400 font-normal">🟢 Connected</span> : 
                      <span className="text-red-600 dark:text-red-400 font-normal">🔴 Disconnected</span>}
                  </li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-1">•</span> Real-time error capture and emission</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-1">•</span> Database-driven user journey tracking</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-1">•</span> Session replay data collection</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-1">•</span> Performance monitoring integration</li>
                  <li className="flex items-start gap-2"><span className="text-blue-500 mt-1">•</span> Cross-browser compatibility testing</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
