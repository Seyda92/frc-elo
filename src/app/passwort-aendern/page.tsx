import { requireAdmin } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = { title: "Passwort ändern" };

export default async function ChangePasswordPage() {
  await requireAdmin();

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-amber">Konto</p>
          <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
            Passwort ändern
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
