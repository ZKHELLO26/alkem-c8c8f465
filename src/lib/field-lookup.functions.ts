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
    const { data: row, error } = await sb.rpc("lookup_employee_public", {
      p_emp_code: data.empCode,
    });
    if (error) {
      console.error("lookupEmployee failed:", error);
      return null;
    }
    if (!row) return null;
    return row as EmployeeLookup;
  });

const DoctorSearchSchema = z.object({
  empCode: z.string().trim().min(2).max(20),
  query: z.string().trim().max(80).default(""),
});

export const searchDoctors = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DoctorSearchSchema.parse(input))
  .handler(async ({ data }): Promise<DoctorOption[]> => {
    const sb = publicClient();
    const { data: rows, error } = await sb.rpc("search_doctors_public", {
      p_emp_code: data.empCode,
      p_query: data.query ?? "",
    });
    if (error) {
      console.error("searchDoctors failed:", error);
      return [];
    }
    return (rows ?? []) as DoctorOption[];
  });

