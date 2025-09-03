import { redirect } from "next/navigation";
import { ProjectDetailView } from "./_components/project-detail-view";

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const projectIdNum = parseInt(projectId, 10);

  if (isNaN(projectIdNum)) {
    redirect("/dashboard/projects");
  }

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <ProjectDetailView projectId={projectIdNum} />
      </div>
    </section>
  );
}