import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, Anchor, Boxes, CalendarClock, MapPin, Package, PackageSearch, Scale, Ship, User } from "lucide-react";
import { getPublicTracking } from "@/lib/tracking.functions";
import { fmtNum, plStatusLabel, unitLabel, type PlStatus } from "@/lib/packing-logic";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const trackQ = (token: string) => queryOptions({ queryKey: ["public-track", token], queryFn: () => getPublicTracking({ data: { token } }) });

export const Route = createFileRoute("/lacak/$token")({
  loader: ({ params, context }) => context.queryClient.ensureQueryData(trackQ(params.token)),
  head: ({ loaderData }) => {
    const t = loaderData ? `Lacak ${loaderData.pl_number} | CV MR EXPRESS` : "Lacak Pengiriman | CV MR EXPRESS";
    const d = loaderData ? `Status pengiriman ${loaderData.pl_number}: ${plStatusLabel[loaderData.status as PlStatus] ?? loaderData.status}.` : "Lacak status pengiriman barang CV MR EXPRESS via kapal PELNI.";
    return { meta: [{ title: t }, { name: "description", content: d }, { property: "og:title", content: t }, { property: "og:description", content: d }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
  component: TrackPage,
  errorComponent: TrackError,
  notFoundComponent: () => <Shell><NotFound /></Shell>,
});

const STEPS: PlStatus[] = ["draft", "siap_dimuat", "dimuat", "berlayar", "tiba", "selesai"];
const d = (s: string | null | undefined) => (s ? fmtDate(s) : "-");

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" />Kembali ke Halaman Utama</Link></Button>
          <span className="text-sm font-extrabold tracking-tight text-primary">CV MR EXPRESS</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
      <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
      <h1 className="mt-3 text-lg font-bold">Kode tracking tidak ditemukan</h1>
      <p className="mt-1 text-sm text-muted-foreground">QR Code atau tautan ini tidak cocok dengan data pengiriman kami. Pastikan Anda memindai label resmi CV MR EXPRESS, atau hubungi kami untuk bantuan.</p>
      <Button asChild className="mt-5"><Link to="/kontak">Hubungi CV MR EXPRESS</Link></Button>
    </div>
  );
}

function TrackError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return <Shell><div className="rounded-xl border bg-card p-8 text-center"><h1 className="text-lg font-bold">Gagal memuat data tracking</h1>
    <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Terjadi kesalahan"}</p>
    <Button className="mt-4" onClick={() => { void router.invalidate(); reset(); }}>Coba lagi</Button></div></Shell>;
}

function Card({ title, icon: Icon, children }: { title: string; icon: typeof Ship; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5"><h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Icon className="h-4 w-4 text-primary" />{title}</h2>{children}</section>;
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-[11px] text-muted-foreground">{k}</dt><dd className="break-words text-sm font-semibold">{v || "-"}</dd></div>;
}

function TrackPage() {
  const { token } = Route.useParams();
  const { data: t } = useSuspenseQuery(trackQ(token));
  if (!t) return <Shell><NotFound /></Shell>;
  const status = t.status as PlStatus;
  const cancelled = status === "dibatalkan";
  const idx = STEPS.indexOf(status);
  const place = (p: { name: string; city: string | null } | null) => (p ? `${p.name}${p.city ? ` (${p.city})` : ""}` : "-");
  return (
    <Shell>
      <div className="space-y-4">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nomor Packing List</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <h1 className="break-all text-2xl font-extrabold">{t.pl_number}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${cancelled ? "bg-destructive/15 text-destructive" : "bg-primary text-primary-foreground"}`}>{plStatusLabel[status] ?? t.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Diperbarui {new Date(t.status_changed_at).toLocaleString("id-ID")}</p>
          {!cancelled && <ol className="mt-5 grid grid-cols-6 gap-1">{STEPS.map((s, i) => (
            <li key={s} className="text-center"><div className={`h-1.5 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />
              <span className={`mt-1 block text-[10px] leading-tight ${i <= idx ? "font-bold" : "text-muted-foreground"}`}>{plStatusLabel[s]}</span></li>))}</ol>}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Pengirim" icon={User}><dl className="grid gap-2"><Row k="Nama" v={t.shipper.name} /><Row k="Kota" v={t.shipper.city} /></dl></Card>
          <Card title="Penerima" icon={MapPin}><dl className="grid gap-2"><Row k="Nama" v={t.consignee.name} /><Row k="Kota" v={t.consignee.city} /></dl></Card>
        </div>

        <Card title="Pelayaran" icon={Ship}>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Row k="Kapal" v={t.vessel} /><Row k="Voyage" v={t.voyage_no} /><Row k="Tanggal PL" v={d(t.pl_date)} />
            <Row k="Pelabuhan Asal" v={place(t.origin)} /><Row k="Pelabuhan Tujuan" v={place(t.destination)} /><Row k="ETD / ETA" v={`${d(t.etd)} / ${d(t.eta)}`} />
          </dl>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          {[{ i: Boxes, k: "Koli", v: fmtNum(t.total_koli) }, { i: Scale, k: "Berat", v: `${fmtNum(t.total_weight_kg)} kg` }, { i: Anchor, k: "Volume", v: `${fmtNum(t.total_volume_m3, 3)} m³` }].map((s) => (
            <div key={s.k} className="rounded-xl border bg-card p-3 text-center shadow-sm"><s.i className="mx-auto h-4 w-4 text-primary" /><p className="mt-1 text-[11px] text-muted-foreground">{s.k}</p><p className="text-sm font-extrabold">{s.v}</p></div>))}
        </div>

        <Card title={`Barang (${t.item_count})`} icon={Package}>
          {!t.items.length ? <p className="text-sm text-muted-foreground">Belum ada data barang.</p> :
            <ul className="divide-y">{t.items.map((i) => (
              <li key={i.line_no} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 py-2 text-sm">
                <span className="min-w-0 break-words font-semibold">{i.line_no}. {i.name}</span>
                <span className="text-right text-xs text-muted-foreground">{fmtNum(i.qty)} {unitLabel[i.unit] ?? i.unit}<br />{fmtNum(Number(i.qty) * Number(i.weight_kg))} kg · {fmtNum(i.volume_m3, 3)} m³</span>
              </li>))}</ul>}
        </Card>

        {!!t.history.length && <Card title="Riwayat Status" icon={CalendarClock}>
          <ol className="space-y-2">{[...t.history].reverse().map((h, i) => (
            <li key={i} className="flex justify-between gap-3 text-sm"><span className="font-semibold">{plStatusLabel[h.to_status as PlStatus] ?? h.to_status}</span><span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString("id-ID")}</span></li>))}</ol>
        </Card>}
      </div>
    </Shell>
  );
}
