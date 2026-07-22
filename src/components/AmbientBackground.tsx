export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-3xl opacity-30 animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.78 0.15 180 / 0.6), transparent 60%)" }}
      />
      <div
        className="absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full blur-3xl opacity-25 animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.70 0.18 240 / 0.55), transparent 60%)", animationDelay: "2s" }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full blur-3xl opacity-20 animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.88 0.20 155 / 0.5), transparent 60%)", animationDelay: "4s" }}
      />
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
