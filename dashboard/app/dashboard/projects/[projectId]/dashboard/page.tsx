'use client';

import * as React from "react";
import { redirect } from "next/navigation";
import { SectionCards } from "@/app/dashboard/_components/section-cards";
import { AnalyticsDashboard } from "@/app/dashboard/_components/analytics-dashboard";
import { ProjectBreadcrumb } from "@/app/dashboard/_components/project-breadcrumb";
import apiClient from "@/lib/revi-api";

interface ProjectDashboardPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDashboardPage({ params }: ProjectDashboardPageProps) {
  const [projectId, setProjectId] = React.useState<string>('');
  const [projectIdNum, setProjectIdNum] = React.useState<number>(0);

  React.useEffect(() => {
    params.then(({ projectId: id }) => {
      setProjectId(id);
      const idNum = parseInt(id, 10);
      if (isNaN(idNum)) {
        redirect("/dashboard/projects");
        return;
      }
      setProjectIdNum(idNum);
      // Set API client project ID once for all components
      apiClient.setProjectId(idNum);
    });
  }, [params]);

  if (!projectIdNum) {
    return <div>Loading...</div>;
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
            <SectionCards projectId={projectIdNum} />
            <AnalyticsDashboard projectId={projectIdNum} />
          </div>
        </div>
      </div>
    </section>
  );
}