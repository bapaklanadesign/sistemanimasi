export type NewUserRole = "super_admin" | "admin1" | "admin2" | "admin_packing";
export type NewUser = { email: string; password: string; fullName: string; role: NewUserRole };
export type ManagedUser = { id: string; email: string; full_name: string; role: NewUserRole | null; active: boolean; last_sign_in_at: string | null; created_at: string };

export function validateNewUser(d: unknown): NewUser {
  const o = (d ?? {}) as Record<string, unknown>;
  const email = String(o["email"] ?? "").trim().toLowerCase();
  const password = String(o["password"] ?? "");
  const fullName = String(o["fullName"] ?? "").trim().slice(0, 80);
  const role = String(o["role"] ?? "") as NewUserRole;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new Error("Email tidak valid");
  if (password.length < 10 || password.length > 72) throw new Error("Password minimal 10 karakter");
  if (!fullName) throw new Error("Nama wajib diisi");
  if (!["super_admin", "admin1", "admin2", "admin_packing"].includes(role)) throw new Error("Peran tidak valid");
  return { email, password, fullName, role };
}