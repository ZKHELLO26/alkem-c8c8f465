// Field-force lookup server functions.
//
// Uses the server publishable (anon) client. The two master tables have
// narrow anon SELECT policies so the public scan form can look up an
// employee by code and search their MCL doctor list without auth.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type EmployeeLookup = {
  empCode: string;
  empName: string;
  designation: string | null;
  hq: string | null;
  region: string | null;
  orgCode: string | null;
};

export type DoctorOption = {
  doctorCode: string | null;
  doctorName: string;
  speciality: string | null;
  hq: string | null;
  subarea: string | null;
};

function publicClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const CodeSchema = z.object({
  empCode: z.string().trim().min(2).max(20),
});

export const lookupEmployee = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CodeSchema.parse(input))
  .handler(async ({ data }): Promise<EmployeeLookup | null> => {
    const sb = publicClient();
    const { data: row, error } = await sb
      .from("employees_master")
      .select("emp_code, emp_name, designation, hq, region, org_code")
      .eq("emp_code", data.empCode)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("lookupEmployee failed:", error);
      return null;
    }
    if (!row) return null;
    const r = row as {
      emp_code: string;
      emp_name: string;
      designation: string | null;
      hq: string | null;
      region: string | null;
      org_code: string | null;
    };
    return {
      empCode: r.emp_code,
      empName: r.emp_name,
      designation: r.designation,
      hq: r.hq,
      region: r.region,
      orgCode: r.org_code,
    };
  });

const DoctorSearchSchema = z.object({
  empCode: z.string().trim().min(2).max(20),
  query: z.string().trim().max(80).default(""),
});

export const searchDoctors = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DoctorSearchSchema.parse(input))
  .handler(async ({ data }): Promise<DoctorOption[]> => {
    const sb = publicClient();
    let q = sb
      .from("doctors_master")
      .select("doctor_code, doctor_name, speciality, hq, subarea")
      .eq("emp_code", data.empCode)
      .order("doctor_name", { ascending: true })
      .limit(15);
    if (data.query) {
      const safe = data.query.replace(/[%_\\]/g, (m) => `\\${m}`);
      q = q.ilike("doctor_name", `%${safe}%`);
    }
    const { data: rows, error } = await q;
    if (error) {
      console.error("searchDoctors failed:", error);
      return [];
    }
    return ((rows ?? []) as Array<{
      doctor_code: string | null;
      doctor_name: string;
      speciality: string | null;
      hq: string | null;
      subarea: string | null;
    }>).map((r) => ({
      doctorCode: r.doctor_code,
      doctorName: r.doctor_name,
      speciality: r.speciality,
      hq: r.hq,
      subarea: r.subarea,
    }));
  });
