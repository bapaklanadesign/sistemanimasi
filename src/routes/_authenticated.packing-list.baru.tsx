import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "./_authenticated";
import { PlForm } from "@/components/packing/pl-form";
import { plMeta } from "@/components/packing/shared";

export const Route = createFileRoute("/_authenticated/packing-list/baru")({
  head: () => plMeta("Packing List Baru", "Buat dokumen Packing List baru."),
  component: () => (<><PageHeader title="Packing List Baru" subtitle="Nomor PL dibuat otomatis saat disimpan" /><PlForm id={null} /></>),
});
