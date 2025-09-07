import { SessionDetailClient } from "./_components/session-detail-client";

interface SessionDetailPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionDetailPage({ 
  params 
}: SessionDetailPageProps) {

  const { sessionId } = await params;

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-light tracking-tight text-gray-800 dark:text-gray-200">
              Session Analysis
            </h1>
            <code className="text-sm bg-white/30 dark:bg-gray-800/30 backdrop-blur-sm border-gray-200 dark:border-gray-700 border px-2 py-1 rounded font-mono text-gray-700 dark:text-gray-300">
              {sessionId.slice(0, 12)}...
            </code>
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            Complete session replay with advanced playback controls, timeline analysis, and user interaction tracking.
          </p>
        </div>
        
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SessionDetailClient sessionId={sessionId} />
          </div>
        </div>
      </div>
    </section>
  );
}