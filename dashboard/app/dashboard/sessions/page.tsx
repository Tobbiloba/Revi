import { SessionListView } from "./_components/session-list-view";

export default async function SessionsPage() {

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Session Management
          </h1>
          <p className="text-muted-foreground">
            Monitor and analyze user sessions with detailed timelines, error tracking, and user journey analysis.
          </p>
        </div>
        
        <SessionListView />
      </div>
    </section>
  );
}