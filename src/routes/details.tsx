import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  DoctorOption,
  EmployeeLookup,
} from "../lib/field-lookup.functions";
import {
  saveDetails,
  saveConsent,
  newScanId,
  loadOrCreateUserId,
  touchSession,
  isSessionStale,
  clearAllScanState,
  type UserDetails,
} from "../lib/scan-store";



export const Route = createFileRoute("/details")({
  head: () => ({
    meta: [
      { title: "Your Details — VitalScan AI" },
      {
        name: "description",
        content: "Enter your details to personalize your AI face vital scan.",
      },
    ],
  }),
  component: DetailsPage,
});

const COUNTRY_CODES = [
  { c: "+91", n: "India", f: "🇮🇳" },
  { c: "+971", n: "UAE", f: "🇦🇪" },
  { c: "+966", n: "KSA", f: "🇸🇦" },
  { c: "+974", n: "Qatar", f: "🇶🇦" },
  { c: "+973", n: "Bahrain", f: "🇧🇭" },
  { c: "+965", n: "Kuwait", f: "🇰🇼" },
  { c: "+968", n: "Oman", f: "🇴🇲" },
  { c: "+20", n: "Egypt", f: "🇪🇬" },
  { c: "+962", n: "Jordan", f: "🇯🇴" },
  { c: "+961", n: "Lebanon", f: "🇱🇧" },
  { c: "+212", n: "Morocco", f: "🇲🇦" },
  { c: "+1", n: "USA", f: "🇺🇸" },
  { c: "+44", n: "UK", f: "🇬🇧" },
];

function cmToFt(cm: number) {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}'${inch}"`;
}

function range(min: number, max: number, step = 1) {
  const out: number[] = [];
  for (let i = min; i <= max; i += step) out.push(i);
  return out;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/20 transition";

function DetailsPage() {
  const navigate = useNavigate();
  const [d, setD] = useState({
    name: "",
    email: "",
    countryCode: "+91",
    mobile: "",
    heightCm: 0,
    weightKg: 0,
    waistIn: 0,
    age: 0,
    sex: "" as "" | "M" | "F",
  });
  const agreed = true;
  const setAgreed = (_: boolean) => {};
  const [err, setErr] = useState<string | null>(null);


  // ── Field-force: employee code lookup ──────────────────────────────
  const [empCode, setEmpCode] = useState("");
  const [emp, setEmp] = useState<EmployeeLookup | null>(null);
  const [empStatus, setEmpStatus] = useState<"idle" | "loading" | "ok" | "notfound">("idle");

  // ── Field-force: doctor typeahead ──────────────────────────────────
  const [docQuery, setDocQuery] = useState("");
  const [docOptions, setDocOptions] = useState<DoctorOption[]>([]);
  const [docOpen, setDocOpen] = useState(false);
  const [doc, setDoc] = useState<DoctorOption | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const docBoxRef = useRef<HTMLDivElement | null>(null);
  const docDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced employee lookup once the code looks complete (>= 4 chars).
  useEffect(() => {
    const code = empCode.trim();
    setEmp(null);
    setDoc(null);
    setDocQuery("");
    setDocOptions([]);
    if (code.length < 4) {
      setEmpStatus("idle");
      return;
    }
    setEmpStatus("loading");
    const t = setTimeout(async () => {
      try {
        const { data: found, error } = await supabase.rpc("lookup_employee_public", {
          p_emp_code: code,
        });
        if (error) throw error;
        if (found) {
          setEmp(found as unknown as EmployeeLookup);
          setEmpStatus("ok");
        } else {
          setEmpStatus("notfound");
        }
      } catch {
        setEmpStatus("notfound");
      }
    }, 80);

    return () => clearTimeout(t);
  }, [empCode]);

  // Debounced doctor search within the employee's own MCL list.
  useEffect(() => {
    if (!emp || doc) return;
    if (docDebounce.current) clearTimeout(docDebounce.current);
    docDebounce.current = setTimeout(async () => {
      setDocLoading(true);
      try {
        const { data: opts, error } = await supabase.rpc("search_doctors_public", {
          p_emp_code: emp.empCode,
          p_query: docQuery.trim(),
        });
        if (error) throw error;
        setDocOptions((opts ?? []) as unknown as DoctorOption[]);

        setDocOpen(true);
      } catch {
        setDocOptions([]);
      } finally {
        setDocLoading(false);
      }
    }, 80);
    return () => {
      if (docDebounce.current) clearTimeout(docDebounce.current);
    };
  }, [docQuery, emp, doc]);

  // Close the doctor dropdown when tapping outside it.
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (docBoxRef.current && !docBoxRef.current.contains(e.target as Node)) {
        setDocOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const pickDoctor = (o: DoctorOption) => {
    setDoc(o);
    setDocQuery(o.doctorName + (o.hq ? ` — ${o.hq}` : ""));
    setDocOpen(false);
  };

  const clearDoctor = () => {
    setDoc(null);
    setDocQuery("");
    setDocOptions([]);
  };

  // If a previous partial session is stale (>30 min), wipe it so users get a
  // clean start instead of resuming a half-completed flow.
  useEffect(() => {
    if (isSessionStale()) clearAllScanState();
    touchSession();
  }, []);

  const validate = (): string | null => {
    if (empCode.trim() && empStatus !== "ok")
      return "Employee code not found. Please check the code or clear the field.";
    if (empStatus === "ok" && !doc)
      return "Please select the doctor from your list.";
    if (!d.name.trim()) return "Please enter your name.";
    if (d.mobile.length !== 10)
      return "Please enter a valid 10-digit mobile number.";
    if (!d.heightCm || !d.weightKg || !d.waistIn || !d.age)
      return "Please select your height, weight, waist and age.";
    if (d.sex !== "M" && d.sex !== "F") return "Please select your gender.";
    if (!agreed) return "Please accept the consent to continue.";
    return null;
  };

  const onStartClick = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setErr(null);
    saveConsent(true, false);
    newScanId();
    loadOrCreateUserId();
    touchSession();
    saveDetails({
      name: d.name,
      email: d.email,
      countryCode: d.countryCode,
      mobile: d.mobile,
      heightCm: d.heightCm,
      weightKg: d.weightKg,
      waistIn: d.waistIn,
      age: d.age,
      sex: d.sex,
      employeeCode: emp?.empCode || undefined,
      employeeName: emp?.empName || undefined,
      employeeHq: emp?.hq || undefined,
      employeeRegion: emp?.region || undefined,
      doctorCode: doc?.doctorCode || undefined,
      doctorName: doc?.doctorName || undefined,
      doctorSpeciality: doc?.speciality || undefined,
      doctorCity: doc?.hq || doc?.subarea || undefined,
      orgCode: emp?.orgCode || undefined,
    } as UserDetails);
    navigate({ to: "/scan" });
  };

  return (
    <main className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-xl animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">
            Tell us about <span className="text-gradient">you</span>
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Used to personalize your wellness insights.
          </p>
        </div>

        <form onSubmit={onStartClick} className="glass glass-strong p-6 md:p-8 space-y-5">
          <Field label="Employee Code">
            <input
              className={inputCls}
              value={empCode}
              onChange={(e) => setEmpCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="Enter your employee code"
              inputMode="text"
              autoComplete="off"
            />
            {empStatus === "loading" && (
              <p className="mt-1.5 text-xs text-muted-foreground/80">Looking up…</p>
            )}
            {empStatus === "notfound" && (
              <p className="mt-1.5 text-xs text-red-400">
                Code not found. Please check and re-enter.
              </p>
            )}
            {empStatus === "ok" && emp && (
              <div className="mt-2 rounded-xl border border-[var(--teal)]/30 bg-[var(--teal)]/10 px-4 py-3 text-sm">
                <div className="font-semibold text-foreground">{emp.empName}</div>
                <div className="text-muted-foreground">
                  {[emp.designation, emp.hq, emp.region].filter(Boolean).join(" • ")}
                </div>
              </div>
            )}
          </Field>

          {empStatus === "ok" && emp && (
            <Field label="Doctor">
              <div className="relative" ref={docBoxRef}>
                <input
                  className={inputCls + (doc ? " pr-10 border-[var(--teal)]/40" : "")}
                  value={docQuery}
                  onChange={(e) => {
                    if (doc) setDoc(null);
                    setDocQuery(e.target.value);
                  }}
                  onFocus={() => {
                    if (!doc) setDocOpen(true);
                  }}
                  placeholder="Type doctor name…"
                  autoComplete="off"
                />
                {doc && (
                  <button
                    type="button"
                    aria-label="Clear doctor"
                    onClick={clearDoctor}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg leading-none"
                  >
                    ×
                  </button>
                )}
                {docOpen && !doc && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto rounded-xl border border-black/10 bg-white shadow-2xl">
                    {docLoading && (
                      <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>
                    )}
                    {!docLoading && docOptions.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500">
                        No matching doctor in your list.
                      </div>
                    )}
                    {!docLoading &&
                      docOptions.map((o, i) => (
                        <button
                          key={(o.doctorCode ?? o.doctorName) + i}
                          type="button"
                          onClick={() => pickDoctor(o)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="text-sm font-medium text-gray-900">{o.doctorName}</div>
                          <div className="text-xs text-gray-600">
                            {[o.speciality, o.hq, o.subarea].filter(Boolean).join(" • ")}
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {doc && (
                <p className="mt-1.5 text-xs text-muted-foreground/80">
                  {[doc.speciality, doc.hq, doc.subarea].filter(Boolean).join(" • ")}
                </p>
              )}
            </Field>
          )}

          <Field label={emp ? "Patient Name" : "Name"}>
            <input
              className={inputCls}
              value={d.name}
              onChange={(e) => setD({ ...d, name: e.target.value })}
              placeholder={emp ? "Patient's name" : "Your name"}
              required
            />
          </Field>

          <Field label={emp ? "Patient WhatsApp Number" : "WhatsApp Number"}>
            <div className="flex gap-2 items-stretch">
              <div className="relative flex-shrink-0">
                <select
                  aria-label="Country code"
                  className={inputCls + " w-[5rem] pr-6 pl-2 appearance-none cursor-pointer font-medium text-sm"}
                  value={d.countryCode}
                  onChange={(e) => setD({ ...d, countryCode: e.target.value })}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.c + c.n} value={c.c} className="bg-background">
                      {c.f} {c.c}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                required
                className={inputCls + " flex-1 min-w-0 text-base tracking-wide"}
                value={d.mobile}
                onChange={(e) => setD({ ...d, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="10-digit number"
              />
            </div>
          </Field>



          <div className="grid grid-cols-2 gap-4">
            <Field label="Height">
              <select
                className={inputCls}
                value={d.heightCm}
                onChange={(e) => setD({ ...d, heightCm: +e.target.value })}
                required
              >
                <option value={0} className="bg-background">Select</option>
                {range(140, 210).map((cm) => (
                  <option key={cm} value={cm} className="bg-background">
                    {cm} cm / {cmToFt(cm)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Weight">
              <select
                className={inputCls}
                value={d.weightKg}
                onChange={(e) => setD({ ...d, weightKg: +e.target.value })}
                required
              >
                <option value={0} className="bg-background">Select</option>
                {range(30, 150).map((kg) => (
                  <option key={kg} value={kg} className="bg-background">{kg} kg</option>
                ))}
              </select>
            </Field>
            <Field label="Waist">
              <select
                className={inputCls}
                value={d.waistIn}
                onChange={(e) => setD({ ...d, waistIn: +e.target.value })}
                required
              >
                <option value={0} className="bg-background">Select</option>
                {range(28, 50).map((w) => (
                  <option key={w} value={w} className="bg-background">{w} in / {Math.round(w * 2.54)} cm</option>
                ))}
              </select>
            </Field>
            <Field label="Age">
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={100}
                placeholder="Enter age"
                className={inputCls}
                value={d.age || ""}
                onChange={(e) => setD({ ...d, age: +e.target.value })}
                required
              />
            </Field>
          </div>

          <Field label="Gender">
            <div className="grid grid-cols-2 gap-2">
              {(["M", "F"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setD({ ...d, sex: s })}
                  className={`rounded-xl border px-4 py-3 text-base font-medium transition ${
                    d.sex === s
                      ? "border-[var(--teal)] bg-[var(--teal)]/15 text-foreground"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  {s === "M" ? "Male" : "Female"}
                </button>
              ))}
            </div>
          </Field>

          {err && <div className="text-base text-destructive">{err}</div>}

          <button
            type="submit"
            className="w-full rounded-full bg-gradient-brand px-6 py-4 text-base font-semibold text-primary-foreground hover:opacity-95 transition shadow-[0_10px_30px_-10px_oklch(0.78_0.15_180/0.6)]"
          >
            Continue →
          </button>
        </form>
      </div>

    </main>
  );
}

