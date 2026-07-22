// Dynamic-import wrapper so route files don't pull the rPPG processor into SSR.
export async function loadRppgProcessor() {
  const mod = await import("./rppg/processor.client");
  return new mod.RppgProcessor();
}

export type { RppgResult } from "./rppg/processor.client";
