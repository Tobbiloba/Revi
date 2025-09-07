import { ProjectListView } from "./_components/project-list-view";

export default async function ProjectsPage() {

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-light tracking-tight text-gray-800 dark:text-gray-200">
            Projects
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-light">
            Manage your error monitoring projects. Create new projects to get API keys for integrating the Revi SDK.
          </p>
        </div>
        <ProjectListView />
      </div>
    </section>
  );
}