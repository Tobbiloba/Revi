import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ErrorListView } from "./_components/error-list-view";

export default async function ErrorsPage() {

  return (
    <section className="flex flex-col items-start justify-start p-6 w-full">
      <div className="w-full">
        <div className="flex flex-col items-start justify-center gap-2 mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            Error Management
          </h1>
          <p className="text-muted-foreground">
            Monitor and analyze application errors across your project. View detailed stack traces, user context, and error patterns.
          </p>
        </div>
        <ErrorListView />
      </div>
    </section>
  );
}