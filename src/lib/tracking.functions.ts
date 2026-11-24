import { createServerFn } from "@tanstack/react-start";

export type PublicTracking = {
  pl_number: string; pl_date: string; status: string; status_changed_at: string; voyage_no: string | null; etd: string | null; eta: string | null;
  total_koli: number; total_weight_kg: number; total_volume_m3: number; item_count: number; vessel: string | null;
  origin: { name: string; city: string | null } | null; destination: { name: string; city: string | null } | null;
  shipper: { name: string; city: string | null }; consignee: { name: string; city: string | null };
  items: { line_no: number; name: string; qty: number; unit: string; weight_kg: number; volume_m3: number }[];
  history: { to_status: string; changed_at: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public lookup by unguessable tracking token; returns only public-safe fields (selected in the SQL function). */
export const getPublicTracking = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => ({ token: String(d?.token ?? "").slice(0, 64) }))
  .handler(async ({ data }): Promise<PublicTracking | null> => {
    if (!UUID.test(data.token)) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.rpc("public_track_packing_list", { _token: data.token });
    if (error) { console.error("tracking lookup failed", error.message); throw new Error("Layanan tracking sedang tidak tersedia"); }
    return (row as unknown as PublicTracking | null) ?? null;
  });
