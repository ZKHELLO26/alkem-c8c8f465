// Field-force lookup server functions.
//
// The scan front-end never touches employees_master / doctors_master
// directly (those tables have RLS enabled with no client policies).
// These server fns are the only read path, and they return only the
// minimal columns the UI needs — no mobile numbers, emails or addresses.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

const CodeSchema = z.object({
  empCode: z.string().trim().min(2).max(20),
});

export const lookupEmployee = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CodeSchema.parse(input))
  .handler(async ({ data }): Promise<EmployeeLookup | null> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: row, error } = await supabaseAdmin
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
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    let q = supabaseAdmin
      .from("doctors_master")
      .select("doctor_code, doctor_name, speciality, hq, subarea")
      .eq("emp_code", data.empCode)
      .order("doctor_name", { ascending: true })
      .limit(15);
    if (data.query) {
      // Escape PostgREST ilike wildcards in user input.
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
