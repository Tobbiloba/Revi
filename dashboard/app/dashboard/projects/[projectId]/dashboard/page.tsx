import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SectionCards } from "@/app/dashboard/_components/section-cards";
import { AnalyticsDashboard } from "@/app/dashboard/_components/analytics-dashboard";
import { ProjectBreadcrumb } from "@/app/dashboard/_components/project-breadcrumb";

interface ProjectDashboardPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDashboardPage({ params }: ProjectDashboardPageProps) {

  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  if (isNaN(projectIdNum)) {
    redirect("/dashboard/projects");
  }

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <ProjectBreadcrumb />
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Project Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring of application errors, user sessions, and performance metrics.
          </p>
        </div>
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards />
            <AnalyticsDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}