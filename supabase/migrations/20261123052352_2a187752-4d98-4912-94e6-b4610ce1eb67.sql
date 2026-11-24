CREATE TABLE public.pl_koli_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packing_list_id uuid NOT NULL REFERENCES public.pl_packing_lists(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 200),
  koli_no integer,
  status text NOT NULL CHECK (status IN ('verified','problem')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 200),
  scanned_by uuid NOT NULL DEFAULT auth.uid(),
  scanned_by_name text,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (packing_list_id, code)
);
CREATE INDEX pl_koli_scans_pl_idx ON public.pl_koli_scans (packing_list_id, scanned_at DESC);
GRANT SELECT, INSERT, DELETE ON public.pl_koli_scans TO authenticated;
GRANT ALL ON public.pl_koli_scans TO service_role;
ALTER TABLE public.pl_koli_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read koli scans" ON public.pl_koli_scans FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY "staff insert own koli scans" ON public.pl_koli_scans FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND scanned_by = auth.uid());
CREATE POLICY "super admin delete koli scans" ON public.pl_koli_scans FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));