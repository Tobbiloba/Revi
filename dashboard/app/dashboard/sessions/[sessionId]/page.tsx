import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionTimelineView } from "./_components/session-timeline-view";

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
            <h1 className="text-3xl font-semibold tracking-tight">
              Session Timeline
            </h1>
            <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
              {sessionId.slice(0, 12)}...
            </code>
          </div>
          <p className="text-muted-foreground">
            Complete session replay with events, errors, and user interactions.
          </p>
        </div>
        
        <SessionTimelineView sessionId={sessionId} />
      </div>
    </section>
  );
}