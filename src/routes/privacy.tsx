import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — VitalScan AI" },
      {
        name: "description",
        content:
          "How VitalScan AI (operated by Zeikon Global) handles your data — written in plain English.",
      },
    ],
  }),
  component: PrivacyPage,
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

function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-12 max-w-3xl mx-auto">
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </a>
      <h1 className="mt-6 text-3xl md:text-4xl font-bold text-gradient">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: June 2026 · Operated by Zeikon Global
      </p>

      <div className="mt-8 space-y-5">
        <Section num={1} title="Who we are">
          <p>
            VitalScan AI is operated by <strong>Zeikon Global</strong> ("we", "us", "our").
            This Privacy Policy explains what data we collect when you use VitalScan AI
            (the "Service"), why we collect it, and what choices you have.
          </p>
        </Section>

        <Section num={2} title="What we collect">
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Your details</strong> — name, optional email, country code, mobile number.</li>
            <li><strong>Profile inputs</strong> — age, sex, height, weight, waist.</li>
            <li><strong>Lifestyle answers</strong> — short questionnaire on exercise, sleep, diet and family history.</li>
            <li><strong>Scan outputs</strong> — your computed wellness metrics (heart rate, HRV, SpO₂, BP range, stress, BMI, risk indicators, mood snapshot).</li>
            <li><strong>Scan signals</strong> — the rPPG waveform and quality metrics used to compute your results.</li>
            <li><strong>Basic device info</strong> — browser type, approximate country (not precise location), app version, and timestamps.</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            We do <strong>not</strong> record continuous video, build facial recognition templates, or try to identify you from your face.
          </p>
        </Section>

        <Section num={3} title="Why we collect it">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>To deliver your scan results.</li>
            <li>To improve scan accuracy and the underlying models.</li>
            <li>To provide support and detect technical issues.</li>
            <li>To meet legal and security obligations.</li>
          </ul>
          <p>
            Our legal basis is your consent (GDPR Art. 6(1)(a); India DPDP Act 2023 consent basis).
            You can withdraw consent at any time.
          </p>
        </Section>

        <Section num={4} title="Communications">
          <p>
            If you opt in, Zeikon Global may contact you by email, SMS or WhatsApp with your
            scan results, wellness tips and product updates. You can unsubscribe at any time
            by replying "STOP" or contacting us through the website.
          </p>
        </Section>

        <Section num={5} title="What we never do">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>We never sell your personal data.</li>
            <li>We never perform facial recognition or identity matching from your scan.</li>
            <li>We never share your data with insurers or advertisers.</li>
            <li>We never make automated decisions that affect your legal rights.</li>
          </ul>
        </Section>

        <Section num={6} title="How long we keep it">
          <p>
            Submissions are retained for up to <strong>24 months</strong>, then anonymized or deleted.
            You can ask us to delete your data earlier at any time.
          </p>
        </Section>

        <Section num={7} title="How we keep it safe">
          <p>
            Data travels over HTTPS and is stored on secure infrastructure. Signal
            artifacts are kept in <strong>private storage</strong> — they are never
            publicly accessible. Access is limited to authorized server-side processes.
          </p>
        </Section>

        <Section num={8} title="Your rights">
          <p>
            You can ask us to access, correct, delete, or stop processing your data — or
            withdraw consent for future processing — by contacting us through the website.
            We typically respond within 30 days.
          </p>
        </Section>

        <Section num={9} title="Not a medical device">
          <p>
            VitalScan AI is for <strong>informational and wellness purposes only</strong>.
            It is not a medical device and does not provide medical diagnosis or treatment.
            Always consult a qualified healthcare professional for medical decisions.
          </p>
        </Section>

        <Section num={10} title="Children">
          <p>The Service is intended for users 18 years and older.</p>
        </Section>

        <Section num={11} title="Changes">
          <p>
            We may update this policy from time to time. Material changes will be reflected
            here with an updated date and, where required, we'll request fresh consent.
          </p>
        </Section>

        <p className="text-sm text-muted-foreground">
          See also:{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">
            Terms of Use
          </a>
          .
        </p>
      </div>
    </main>
  );
}
