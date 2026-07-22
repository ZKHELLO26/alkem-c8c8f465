import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — VitalScan AI" },
      {
        name: "description",
        content: "Start your VitalScan AI face scan dashboard for contactless wellness insights.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <section className="glass gradient-border card-pop w-full max-w-md p-7 text-center">
        <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-gradient-brand glow-teal" />
        <h1 className="text-3xl font-bold tracking-tight text-gradient">VitalScan AI</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium text-muted-foreground">
          Your dashboard is ready. Continue to begin the face scan flow.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Link
            to="/details"
            className="inline-flex items-center justify-center rounded-full bg-gradient-brand px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_oklch(0.62_0.16_200/0.6)] transition-transform hover:scale-[1.02]"
          >
            Start scan
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent/60"
          >
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}