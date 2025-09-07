import { SessionListView } from "@/app/dashboard/sessions/_components/session-list-view";

interface ProjectSessionsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectSessionsPage({ params }: ProjectSessionsPageProps) {

  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  // if (isNaN(projectIdNum)) {
  //   redirect("/dashboard/projects");
  // }

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-light tracking-tight text-gray-800 dark:text-gray-200">
            Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            View user sessions and replay user interactions for this project.
          </p>
        </div>
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SessionListView projectId={projectIdNum} />
          </div>
        </div>
      </div>
    </section>
  );
}