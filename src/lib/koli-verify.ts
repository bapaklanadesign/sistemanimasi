// Pure helpers for matching scanned koli label codes to a Packing List (shared by UI, server and tests).
export type ProblemKind = "not_mrx" | "invalid_number" | "other_pl" | "total_mismatch";
export type ParsedScan = { code: string; pl: string; n: number; total: number } | { code: string; error: string; kind: ProblemKind };

export function parseKoliCode(code: string): ParsedScan {
  let parts = code.trim().split("|");
  if (parts[0] !== "MRX") {
    try {
      const u = new URL(code.trim());
      if (!/^\/lacak\/[^/]+$/.test(u.pathname)) throw new Error();
      parts = ["MRX", u.searchParams.get("pl") ?? "", u.searchParams.get("koli") ?? "", u.searchParams.get("total") ?? ""];
    } catch { return { code, error: "Bukan label koli MR Express", kind: "not_mrx" }; }
  }
  if (parts.length !== 4) return { code, error: "Bukan label koli MR Express", kind: "not_mrx" };
  const n = Number(parts[2]), total = Number(parts[3]);
  if (!parts[1] || !Number.isInteger(n) || !Number.isInteger(total) || n < 1 || n > total) return { code, error: "Nomor koli tidak valid", kind: "invalid_number" };
  return { code, pl: parts[1], n, total };
}

/** Koli numbers 1..total that have a valid scan for this packing list. */
export function matchScans(plNumber: string, total: number, codes: string[]) {
  const verified = new Set<number>();
  const problems: { code: string; reason: string }[] = [];
  for (const c of codes) {
    const p = parseKoliCode(c);
    if ("error" in p) problems.push({ code: c, reason: p.error });
    else if (p.pl !== plNumber) problems.push({ code: c, reason: `Milik Packing List lain (${p.pl})` });
    else if (p.total !== total || p.n > total) problems.push({ code: c, reason: `Jumlah koli label (${p.total}) tidak sama dengan data (${total})` });
    else verified.add(p.n);
  }
  const unverified = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !verified.has(n));
  return { verified: [...verified].sort((a, b) => a - b), unverified, problems };
}

/** Classifies one scanned code against a packing list. */
export function classifyScan(plNumber: string, total: number, code: string):
  { status: "verified"; koli: number } | { status: "problem"; kind: ProblemKind; reason: string; koli: number | null } {
  const p = parseKoliCode(code);
  if ("error" in p) return { status: "problem", kind: p.kind, reason: p.error, koli: null };
  if (p.pl !== plNumber) return { status: "problem", kind: "other_pl", reason: `Milik Packing List lain (${p.pl})`, koli: p.n };
  if (p.total !== total) return { status: "problem", kind: "total_mismatch", reason: `Jumlah koli label (${p.total}) tidak sama dengan data (${total})`, koli: p.n };
  return { status: "verified", koli: p.n };
}
