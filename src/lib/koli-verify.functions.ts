import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { matchScans } from "./koli-verify";
import { labelCount } from "./packing-pdf";

export const verifyKoliScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plId: string; codes: string[] }) => {
    if (typeof d?.plId !== "string" || !Array.isArray(d.codes)) throw new Error("Data tidak valid");
    return { plId: d.plId, codes: d.codes.filter((c) => typeof c === "string").slice(0, 3000).map((c) => c.slice(0, 200)) };
  })
  .handler(async ({ data, context }) => {
    const { data: pl, error } = await context.supabase.from("pl_packing_lists").select("pl_number,total_koli").eq("id", data.plId).maybeSingle();
    if (error || !pl) throw new Error("Packing List tidak ditemukan atau Anda tidak punya akses");
    const total = labelCount(pl.total_koli);
    const result = matchScans(pl.pl_number, total, data.codes);
    let summary = "";
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const res = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions: "Anda membantu petugas gudang ekspedisi memverifikasi koli. Tulis ringkasan singkat (maks 4 kalimat, Bahasa Indonesia) dari hasil pencocokan: berapa koli terverifikasi, nomor koli yang belum terverifikasi (ringkas sebagai rentang), dan label bermasalah beserta kemungkinan penyebabnya. Jangan mengarang angka di luar data.",
        input: JSON.stringify({ packing_list: pl.pl_number, total_koli: total, jumlah_pindaian: data.codes.length, terverifikasi: result.verified.length, belum_terverifikasi: result.unverified, label_bermasalah: result.problems.slice(0, 50) }),
      });
      const r = res as unknown as { output?: { type: string; content?: { type: string; text?: string }[] }[] };
      summary = (r.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("").trim();
    } catch (e) {
      console.error("AI summary failed", e);
      summary = "";
    }
    return { plNumber: pl.pl_number, total, ...result, summary };
  });
