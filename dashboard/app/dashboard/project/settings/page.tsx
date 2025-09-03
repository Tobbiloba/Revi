import { ProjectSettingsView } from "./_components/project-settings-view";

export default async function ProjectSettingsPage() {


  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Project Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your project configuration, API keys, alert settings, and integrations.
          </p>
        </div>
        
        <ProjectSettingsView />
      </div>
    </section>
  );
}