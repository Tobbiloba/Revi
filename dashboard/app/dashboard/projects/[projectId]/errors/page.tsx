import { auth } from "@/lib/auth";
import { headers } from "next/headers";
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
          <h1 className="text-3xl font-semibold tracking-tight">
            Errors
          </h1>
          <p className="text-muted-foreground">
            Monitor and track application errors for this project.
          </p>
        </div>
        <ErrorListView />
      </div>
    </section>
  );
}