import { redirect } from "next/navigation";
import { ErrorListView } from "@/app/dashboard/errors/_components/error-list-view";

interface ProjectErrorsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectErrorsPage({ params }: ProjectErrorsPageProps) {

  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  if (isNaN(projectIdNum)) {
    redirect("/dashboard/projects");
  }

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-light tracking-tight text-gray-800 dark:text-gray-200">
            Errors
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            Monitor and track application errors for this project.
          </p>
        </div>
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <ErrorListView />
          </div>
        </div>
      </div>
    </section>
  );
}