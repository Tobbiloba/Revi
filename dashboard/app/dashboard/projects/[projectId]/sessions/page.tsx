import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionListView } from "@/app/dashboard/sessions/_components/session-list-view";

interface ProjectSessionsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSessionsPage({ params }: ProjectSessionsPageProps) {

  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  if (isNaN(projectIdNum)) {
    redirect("/dashboard/projects");
  }

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sessions
          </h1>
          <p className="text-muted-foreground">
            View user sessions and replay user interactions for this project.
          </p>
        </div>
        <SessionListView />
      </div>
    </section>
  );
}