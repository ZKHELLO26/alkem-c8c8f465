import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resolveScanLink, saveLinkConfig, clearLinkConfig } from "../lib/scan-link";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Opening scan… — VitalScan AI" },
      { name: "description", content: "Opening your assigned wellness scan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanLinkLanding,
});

const REASONS: Record<string, string> = {
  not_found: "This scan link doesn't exist. Please check the link or QR code you received.",
  revoked: "This scan link has been paused by the organizer.",
  org_suspended: "This program is currently paused.",
  expired: "This scan link has expired.",
  quota_reached: "This scan link has reached its maximum number of scans.",
  error: "Something went wrong opening this link. Please try again.",
};

function ScanLinkLanding() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "dead">("loading");
  const [reason, setReason] = useState<string>("error");

  useEffect(() => {
    let alive = true;
    clearLinkConfig();
    resolveScanLink(token).then((cfg) => {
      if (!alive) return;
      if (cfg.ok) {
        saveLinkConfig(cfg);
        navigate({ to: "/details", replace: true });
      } else {
        setReason(cfg.reason ?? "error");
        setState("dead");
      }
    });
    return () => {
      alive = false;
    };
  }, [token, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass glass-strong p-8 max-w-md w-full text-center space-y-3">
        {state === "loading" ? (
          <>
            <div className="text-2xl">🔗</div>
            <h1 className="text-lg font-semibold">Opening your scan…</h1>
            <p className="text-sm text-muted-foreground">One moment.</p>
          </>
        ) : (
          <>
            <div className="text-2xl">⚠️</div>
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="text-sm text-muted-foreground">
              {REASONS[reason] ?? REASONS.error}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
