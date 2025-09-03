import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreateProjectForm } from "./_components/create-project-form";

export default async function CreateProjectPage() {

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full max-w-2xl mx-auto">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Create New Project
          </h1>
          <p className="text-muted-foreground">
            Set up a new monitoring project to get started with error tracking and session replay.
          </p>
        </div>
        <CreateProjectForm />
      </div>
    </section>
  );
}