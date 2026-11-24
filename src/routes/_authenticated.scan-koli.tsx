import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, CameraOff, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "./_authenticated";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { plMeta } from "@/components/packing/shared";
import { plListQ } from "@/lib/packing-data";
import { labelCount } from "@/lib/packing-pdf";
import { classifyScan, matchScans } from "@/lib/koli-verify";
import { verifyKoliScans } from "@/lib/koli-verify.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/scan-koli")({
  head: () => plMeta("Scan Label Koli", "Pindai QR label koli dan cocokkan dengan data Packing List."),
  component: Page,
});

type AiResult = Awaited<ReturnType<typeof verifyKoliScans>>;

function Page() {
  const q = useQuery(plListQ());
  const [plId, setPlId] = useState("");
  const qc = useQueryClient();
  const { role, session } = useAuth();
  const scansQ = useQuery({
    queryKey: ["pl", "koli-scans", plId], enabled: !!plId,
    queryFn: async () => {
      const { data, error } = await supabase.from("pl_koli_scans").select("id,code,koli_no,status,reason,scanned_by_name,scanned_at").eq("packing_list_id", plId).order("scanned_at", { ascending: false });
      if (error) throw error; return data;
    },
  });
  const codes = useMemo(() => (scansQ.data ?? []).map((r) => r.code), [scansQ.data]);
  const [manual, setManual] = useState("");
  const [camOn, setCamOn] = useState(false);
  const [ai, setAi] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const verify = useServerFn(verifyKoliScans);
  const pl = q.data?.find((p) => p.id === plId);
  const total = pl ? labelCount(pl.total_koli) : 0;
  const local = useMemo(() => (pl ? matchScans(pl.pl_number, total, codes) : null), [pl, total, codes]);

  const add = async (c: string, source: "camera" | "manual") => {
    const code = c.trim(); if (!code || !pl) return;
    const track = window.__lovableEvents?.track;
    if (codes.includes(code)) { track?.("project.koli_qr_scanned", { result: "duplicate", source }); toast.info("Label ini sudah dipindai sebelumnya"); return; }
    const r = classifyScan(pl.pl_number, total, code);
    const { error } = await supabase.from("pl_koli_scans").insert({
      packing_list_id: pl.id, code, koli_no: r.koli, status: r.status, reason: r.status === "problem" ? r.reason : null,
      scanned_by_name: session?.user.email ?? null,
    });
    if (error) { if (error.code === "23505") { toast.info("Label ini sudah dipindai sebelumnya"); return; } toast.error("Gagal menyimpan hasil pindai"); return; }
    track?.("project.koli_qr_scanned", { result: r.status, source });
    if (r.status === "verified") { track?.("project.koli_verified", { source }); toast.success(`Koli ${r.koli}/${total} terverifikasi`); }
    else { track?.("project.koli_label_problem", { kind: r.kind }); toast.error(r.reason); }
    setAi(null);
    await qc.invalidateQueries({ queryKey: ["pl", "koli-scans", pl.id] });
  };

  const reset = async () => {
    if (!pl || !confirm("Hapus semua riwayat pindai untuk Packing List ini?")) return;
    const { error } = await supabase.from("pl_koli_scans").delete().eq("packing_list_id", pl.id);
    if (error) { toast.error("Gagal menghapus riwayat"); return; }
    setAi(null); await qc.invalidateQueries({ queryKey: ["pl", "koli-scans", pl.id] });
  };

  const runAi = async () => {
    if (!plId) return;
    setBusy(true);
    try { setAi(await verify({ data: { plId, codes } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Gagal mencocokkan"); }
    finally { setBusy(false); }
  };

  const verified = new Set(ai?.verified ?? local?.verified ?? []);
  return (
    <>
      <PageHeader title="Scan Label Koli" subtitle="Pindai QR di stiker koli lalu cocokkan dengan data Packing List" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="1. Pilih Packing List">
          <Select value={plId} onValueChange={(v) => { setPlId(v); setAi(null); }}>
            <SelectTrigger aria-label="Packing List"><SelectValue placeholder="Pilih Packing List" /></SelectTrigger>
            <SelectContent>{q.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.pl_number} · {p.consignee?.name ?? "-"} ({labelCount(p.total_koli)} koli)</SelectItem>)}</SelectContent>
          </Select>
          <div className="mt-4 space-y-3">
            <Button size="sm" variant={camOn ? "outline" : "default"} disabled={!plId} onClick={() => setCamOn((v) => !v)}>
              {camOn ? <><CameraOff className="h-4 w-4" />Matikan kamera</> : <><Camera className="h-4 w-4" />Pindai dengan kamera</>}
            </Button>
            {camOn && <Scanner onCode={(c) => void add(c, "camera")} />}
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void add(manual, "manual"); setManual(""); }}>
              <Input placeholder="Atau ketik / tempel kode label" value={manual} onChange={(e) => setManual(e.target.value)} disabled={!plId} />
              <Button type="submit" size="sm" variant="outline" disabled={!plId}>Tambah</Button>
            </form>
          </div>
        </Panel>
        <Panel title={`2. Hasil (${local?.verified.length ?? 0}/${total} koli terverifikasi)`} action={<div className="flex gap-2">
          {role === "super_admin" && <Button size="sm" variant="ghost" disabled={!codes.length} onClick={reset}><Trash2 className="h-4 w-4" />Reset</Button>}
          <Button size="sm" onClick={runAi} disabled={!plId || busy}><Sparkles className="h-4 w-4" />{busy ? "Mencocokkan..." : "Cocokkan dengan AI"}</Button></div>}>
          {!pl ? <p className="text-sm text-muted-foreground">Pilih Packing List terlebih dahulu.</p> : <>
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                <span key={n} title={verified.has(n) ? "Terverifikasi" : "Belum terverifikasi"}
                  className={cn("rounded py-1 text-center text-[11px] font-bold", verified.has(n) ? "bg-success text-primary-foreground" : "bg-destructive/15 text-destructive")}>{n}</span>))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Hijau = terverifikasi · Merah = belum terverifikasi</p>
            {!!local?.problems.length && <div className="mt-3 space-y-1"><p className="text-xs font-semibold text-destructive">Label bermasalah</p>
              {local.problems.map((p) => <p key={p.code} className="break-all text-xs">{p.code} — {p.reason}</p>)}</div>}
            {ai && <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm"><p className="mb-1 flex items-center gap-1 text-xs font-semibold"><Sparkles className="h-3 w-3" />Ringkasan AI</p>
              <p className="whitespace-pre-line">{ai.summary || "Ringkasan AI tidak tersedia saat ini. Hasil pencocokan di atas tetap berlaku."}</p></div>}
          </>}
        </Panel>
      </div>
      {pl && <div className="mt-4"><Panel title={`Riwayat pindai ${pl.pl_number} (${scansQ.data?.length ?? 0})`}>
        {!scansQ.data?.length ? <p className="text-sm text-muted-foreground">Belum ada pindaian. Pindaian tersimpan otomatis, jadi bisa dilanjutkan kapan saja.</p> :
          <ul className="divide-y text-xs">{scansQ.data.map((r) => <li key={r.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 py-2">
            <span className={cn("font-bold", r.status === "verified" ? "text-success" : "text-destructive")}>{r.status === "verified" ? `Koli ${r.koli_no}` : "Bermasalah"}</span>
            <span className="min-w-0 break-all">{r.status === "verified" ? r.code : `${r.code} — ${r.reason ?? ""}`}</span>
            <span />
            <span className="text-muted-foreground">{new Date(r.scanned_at).toLocaleString("id-ID")} · {r.scanned_by_name ?? "-"}</span>
          </li>)}</ul>}
      </Panel></div>}
    </>
  );
}

function Scanner({ onCode }: { onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onCode); cb.current = onCode;
  const [err, setErr] = useState("");
  useEffect(() => {
    let stream: MediaStream | null = null; let raf = 0; let stop = false; let last = ""; let lastAt = 0;
    (async () => {
      try {
        const jsQR = (await import("jsqr")).default;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = video.current; if (!v || stop) return;
        v.srcObject = stream; await v.play();
        const canvas = document.createElement("canvas"); const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const tick = () => {
          if (stop) return;
          if (ctx && v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight; ctx.drawImage(v, 0, 0);
            const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (r?.data && (r.data !== last || Date.now() - lastAt > 3000)) { last = r.data; lastAt = Date.now(); cb.current(r.data); }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { setErr("Kamera tidak dapat dibuka. Izinkan akses kamera atau ketik kode secara manual."); }
    })();
    return () => { stop = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return err ? <p className="text-sm text-destructive">{err}</p> : <video ref={video} muted playsInline className="w-full rounded-md border bg-muted" />;
}
