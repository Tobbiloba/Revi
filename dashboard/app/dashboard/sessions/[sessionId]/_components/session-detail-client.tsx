'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleSessionReplay } from '../../_components/simple-session-replay';
import { SessionTimelineView } from './session-timeline-view';
import { SessionReplayErrorBoundary } from '../../_components/session-replay-error-boundary';

interface SessionDetailClientProps {
  sessionId: string;
}

export function SessionDetailClient({ sessionId }: SessionDetailClientProps) {
  return (
    <SessionReplayErrorBoundary sessionId={sessionId}>
      <div className="w-full space-y-6">
        <Tabs defaultValue="replay" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700">
            <TabsTrigger value="replay" className="font-normal text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 dark:data-[state=active]:bg-gray-700/50 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-200">▶️ Session Replay</TabsTrigger>
            <TabsTrigger value="timeline" className="font-normal text-gray-700 dark:text-gray-300 data-[state=active]:bg-white/50 dark:data-[state=active]:bg-gray-700/50 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-200">📊 Event Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="replay" className="mt-6">
            <SimpleSessionReplay sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <SessionTimelineView key={`timeline-${sessionId}`} sessionId={sessionId} />
          </TabsContent>
        </Tabs>
      </div>
    </SessionReplayErrorBoundary>
  );
}