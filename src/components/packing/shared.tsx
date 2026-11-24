import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PL_STATUSES, plStatusLabel, plStatusTone, type PlStatus } from "@/lib/packing-logic";
import { plDetailQ, plError, setPlStatus } from "@/lib/packing-data";
import { labelCount, printPackingList, printKoliLabels } from "@/lib/packing-pdf";
import { Input } from "@/components/ui/input";

export function PlStatusBadge({ s, className }: { s: PlStatus; className?: string }) {
  return <span className={cn("dash-pill", plStatusTone[s], className)}>{plStatusLabel[s]}</span>;
}

/** Refreshes every Packing List query (lists, detail, dashboard, reports, activity). */
export function usePlRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pl"] });
}

/** Reads the Packing List fresh from the database, then downloads its PDF. */
export function usePrintPl() {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const print = async (id: string) => {
    setBusyId(id);
    try {
      const pl = await qc.fetchQuery({ ...plDetailQ(id), staleTime: 0 });
      if (!pl) throw new Error("Packing list tidak ditemukan");
      await printPackingList(pl);
      toast.success(`PDF ${pl.pl_number} diunduh`);
    } catch (e) { toast.error(plError(e)); }
    finally { setBusyId(null); }
  };
  return { print, busyId };
}

export function usePrintLabels() {
  const qc = useQueryClient();
  const [labelBusyId, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<{ id: string; total: number; pl: string } | null>(null);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");
  const printLabels = async (id: string) => {
    setBusy(id);
    try {
      const pl = await qc.fetchQuery({ ...plDetailQ(id), staleTime: 0 });
      if (!pl) throw new Error("Packing list tidak ditemukan");
      const total = labelCount(pl.total_koli);
      setFrom("1"); setTo(String(total)); setTarget({ id, total, pl: pl.pl_number });
    } catch (e) { toast.error(plError(e)); }
    finally { setBusy(null); }
  };
  const run = async () => {
    if (!target) return;
    const f = Number(from), t = Number(to);
    if (!Number.isInteger(f) || !Number.isInteger(t) || f < 1 || t < f || t > target.total) { toast.error(`Rentang koli harus antara 1 dan ${target.total}`); return; }
    setBusy(target.id);
    try {
      const pl = await qc.fetchQuery({ ...plDetailQ(target.id), staleTime: 0 });
      if (!pl) throw new Error("Packing list tidak ditemukan");
      await printKoliLabels(pl, { from: f, to: t });
      toast.success(`Label koli ${f}–${t} dari ${pl.pl_number} diunduh`);
      setTarget(null);
    } catch (e) { toast.error(plError(e)); }
    finally { setBusy(null); }
  };
  const labelDialog = (
    <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cetak Label Koli {target?.pl}</DialogTitle>
          <DialogDescription>Total {target?.total} koli. Pilih nomor koli yang ingin dicetak.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Dari koli<Input type="number" min={1} max={target?.total} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs font-semibold">Sampai koli<Input type="number" min={1} max={target?.total} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTarget(null)}>Batal</Button>
          <Button onClick={run} disabled={labelBusyId === target?.id}>{labelBusyId === target?.id ? "Menyiapkan..." : "Cetak"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
  return { printLabels, labelBusyId, labelDialog };
}

export function StatusDialog({ pl, onClose }: { pl: { id: string; pl_number: string; status: PlStatus } | null; onClose: () => void }) {
  const refresh = usePlRefresh();
  const [status, setStatus] = useState<PlStatus>(pl?.status ?? "draft");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);
  if (pl && pl.id !== lastId) { setLastId(pl.id); setStatus(pl.status); setNote(""); setErr(null); }

  const save = async () => {
    if (!pl) return;
    if (status === pl.status) return setErr("Pilih status yang berbeda dari status sekarang");
    if (status === "dibatalkan" && note.trim().length < 5) return setErr("Alasan pembatalan wajib diisi (minimal 5 karakter)");
    setBusy(true); setErr(null);
    try {
      await setPlStatus(pl.id, status, note);
      toast.success(`Status ${pl.pl_number} menjadi ${plStatusLabel[status]}`);
      await refresh();
      onClose();
    } catch (e) { setErr(plError(e)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!pl} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ubah Status Pengiriman</DialogTitle>
          <DialogDescription>{pl?.pl_number} · sekarang <b>{pl ? plStatusLabel[pl.status] : ""}</b></DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={status} onValueChange={(v) => setStatus(v as PlStatus)}>
            <SelectTrigger aria-label="Status baru"><SelectValue /></SelectTrigger>
            <SelectContent>{PL_STATUSES.map((s) => <SelectItem key={s} value={s}>{plStatusLabel[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea placeholder={status === "dibatalkan" ? "Alasan pembatalan (wajib)" : "Catatan (opsional)"} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p role="alert" className="rounded bg-danger-soft px-3 py-2 text-xs text-destructive">{err}</p>}
          <Button className="w-full" onClick={save} disabled={busy}>{busy ? "Menyimpan..." : "Simpan Status"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
    className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm sm:w-64" />;
}

export const plMeta = (title: string, description: string) => ({
  meta: [{ name: "robots", content: "noindex, nofollow" }, { title: `${title} — CV MR Express` }, { name: "description", content: description },
    { property: "og:title", content: `${title} — CV MR Express` }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }],
});
