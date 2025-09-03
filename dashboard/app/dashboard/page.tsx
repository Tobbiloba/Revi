
import { ProjectsOverview } from "./_components/projects-overview";

export default async function Dashboard() {

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor all your projects and access error tracking across your applications.
          </p>
        </div>
        <ProjectsOverview />
      </div>
    </section>
  );
}
