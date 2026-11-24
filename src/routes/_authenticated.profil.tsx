import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "./_authenticated";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { supabase } from "@/integrations/supabase/client";
import { roleLabel, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }, { title: "Profil — CV MR Express" }, { name: "description", content: "Ubah nama dan password akun." }, { property: "og:title", content: "Profil — CV MR Express" }, { property: "og:description", content: "Ubah nama dan password akun." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Page,
});

function Page() {
  const { session, role, fullName } = useAuth();
  const [name, setName] = useState(fullName);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(fullName), [fullName]);

  const saveName = async () => {
    if (!name.trim()) { toast.error("Nama wajib diisi"); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim().slice(0, 80) }).eq("id", session!.user.id);
    setBusy(false);
    error ? toast.error(error.message) : toast.success("Nama tersimpan");
  };
  const savePw = async () => {
    if (pw.next.length < 10) { toast.error("Password baru minimal 10 karakter"); return; }
    if (!pw.current) { toast.error("Password saat ini wajib diisi"); return; }
    if (pw.next === pw.current) { toast.error("Password baru harus berbeda dari password saat ini"); return; }
    const email = session?.user.email;
    if (!email) { toast.error("Sesi tidak valid, silakan login ulang"); return; }
    setBusy(true);
    const check = await supabase.auth.signInWithPassword({ email, password: pw.current });
    if (check.error) { setBusy(false); toast.error("Password saat ini salah"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password diperbarui"); setPw({ current: "", next: "" });
  };

  return (
    <>
      <PageHeader title="Profil" />
      <main className="grid max-w-3xl gap-4 p-4 md:grid-cols-2">
        <Panel title="Data Akun">
          <div className="space-y-3 text-sm">
            <p>Email: <b>{session?.user.email}</b></p><p>Peran: <b>{role ? roleLabel[role] : "-"}</b></p>
            <Input aria-label="Nama" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <Button onClick={saveName} disabled={busy}>Simpan Nama</Button>
          </div>
        </Panel>
        <Panel title="Ganti Password">
          <div className="space-y-3">
            <PasswordInput placeholder="Password saat ini" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <PasswordInput placeholder="Password baru (min. 10)" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <Button onClick={savePw} disabled={busy}>Ganti Password</Button>
          </div>
        </Panel>
      </main>
    </>
  );
}
