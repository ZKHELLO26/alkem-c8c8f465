import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AmbientBackground } from "../components/AmbientBackground";
import { Footer } from "../components/Footer";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center glass p-8">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "AI Face Vital Scan — Wellness Insights within 30 Seconds" },
      { name: "description", content: "Contactless AI face scan that estimates heart rate, HRV, stress, BP range, SpO₂, and 25+ wellness risks within 30 seconds." },
      { name: "theme-color", content: "#0A0F14" },
      { property: "og:title", content: "AI Face Vital Scan — Wellness Insights within 30 Seconds" },
      { property: "og:description", content: "Contactless AI face scan that estimates heart rate, HRV, stress, BP range, SpO₂, and 25+ wellness risks within 30 seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AI Face Vital Scan — Wellness Insights within 30 Seconds" },
      { name: "twitter:description", content: "Contactless AI face scan that estimates heart rate, HRV, stress, BP range, SpO₂, and 25+ wellness risks within 30 seconds." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/dcb2c45f-4919-487d-94c5-0cbbf86537b5" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/dcb2c45f-4919-487d-94c5-0cbbf86537b5" },
    ],

    links: [{ rel: "stylesheet", href: appCss },],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <AmbientBackground />
      <Outlet />
      <Footer />
    </>
  );
}
