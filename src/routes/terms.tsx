import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — VitalScan AI" },
      {
        name: "description",
        content: "Terms of use for VitalScan AI, operated by Zeikon Global.",
      },
    ],
  }),
  component: TermsPage,
});

function Section({
  num,
  title,
  children,
}: {
  num: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 md:p-6">
      <h2 className="text-xl font-semibold">
        {num}. {title}
      </h2>
      <div className="mt-3 space-y-3 text-foreground/85 leading-relaxed">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </a>
      <h1 className="mt-6 text-3xl md:text-4xl font-bold text-gradient">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: June 2026 · Operated by Zeikon Global
      </p>

      <div className="mt-8 space-y-5">
        <Section num={1} title="Accepting these Terms">
          <p>
            By using VitalScan AI (the "Service") you agree to these Terms. If you don't
            agree, please don't use the Service.
          </p>
        </Section>

        <Section num={2} title="Informational only">
          <p>
            The Service is for <strong>informational and wellness purposes only</strong>.
            It is <strong>not a medical device</strong>, does not diagnose, treat or
            replace medical advice, and must never be used in emergencies. Always consult
            a qualified healthcare professional for medical decisions.
          </p>
        </Section>

        <Section num={3} title="Acceptable use">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>You must be at least 18 years old.</li>
            <li>Please provide accurate information about yourself so results make sense.</li>
            <li>Don't reverse-engineer, scrape, attack or misuse the Service.</li>
          </ul>
        </Section>

        <Section num={4} title="Accuracy & warranties">
          <p>
            Results are estimates produced by an AI pipeline and may be inaccurate. The
            Service is provided <strong>"as is"</strong> without warranties of any kind,
            express or implied, including merchantability, fitness for a particular
            purpose, or non-infringement.
          </p>
        </Section>

        <Section num={5} title="Limitation of liability">
          <p>
            To the maximum extent permitted by law, Zeikon Global is not liable for any
            indirect, incidental, special, consequential or punitive damages arising from
            your use of the Service, including any health decisions you make based on
            its output.
          </p>
        </Section>

        <Section num={6} title="Data & privacy">
          <p>
            Use of the Service is subject to our{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
              Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section num={7} title="Changes">
          <p>
            We may modify the Service or these Terms at any time. Material changes will
            be surfaced in-app where reasonable.
          </p>
        </Section>

        <Section num={8} title="Governing law">
          <p>
            These Terms are governed by the laws of India. Disputes will be handled in
            the courts of competent jurisdiction in India.
          </p>
        </Section>
      </div>
    </main>
  );
}
