// Tokenised scan-link resolver. A link like https://<scan-app>/s/AbC123xyz
// carries: which client (org), which AI tool, and which form fields to show.
// Calls the public `get_scan_link` RPC directly from the browser using the
// anon client — no service role key required.
import { supabase } from "@/integrations/supabase/client";

export type ScanLinkConfig = {
  ok: boolean;
  reason?: string;
  token?: string;
  orgCode?: string;
  orgName?: string;
  productCode?: string;
  label?: string | null;
  fields?: Record<string, boolean> | null;
};

const STORAGE_KEY = "zk_scan_link";

export async function resolveScanLink(token: string): Promise<ScanLinkConfig> {
  try {
    const { data, error } = await supabase.rpc("get_scan_link", {
      p_token: token,
    });
    if (error || !data) {
      console.warn("get_scan_link failed:", error);
      return { ok: false, reason: "error" };
    }
    const c = data as unknown as Record<string, unknown>;
    if (!c.ok) return { ok: false, reason: String(c.reason ?? "invalid") };
    return {
      ok: true,
      token: String(c.token),
      orgCode: String(c.org_code),
      orgName: String(c.org_name ?? c.org_code),
      productCode: String(c.product_code),
      label: (c.label as string | null) ?? null,
      fields: (c.fields as Record<string, boolean> | null) ?? null,
    };
  } catch (e) {
    console.warn("resolveScanLink error:", e);
    return { ok: false, reason: "error" };
  }
}

export function loadLinkConfig(): ScanLinkConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as ScanLinkConfig;
    return cfg.ok ? cfg : null;
  } catch {
    return null;
  }
}

export function saveLinkConfig(cfg: ScanLinkConfig) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function clearLinkConfig() {
  sessionStorage.removeItem(STORAGE_KEY);
}
