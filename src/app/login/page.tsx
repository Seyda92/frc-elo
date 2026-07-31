import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata = {
  title: "Login",
  robots: { index: false },
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/admin" : "/");

  return (
    <div className="min-h-[calc(100svh-3.5rem)] bg-asphalt">
      <div className="border-b border-line bg-asphalt-raised/80">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-amber">Verwaltung</p>
          <h1 className="font-display text-3xl tracking-tight text-foam sm:text-4xl">
            Login
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-md px-3 py-6 sm:px-6 sm:py-8">
        <section className="border border-line bg-asphalt-raised/40">
          <header className="border-b border-line px-4 py-4">
            <h2 className="font-display text-2xl tracking-tight text-foam">Anmelden</h2>
          </header>
          <LoginForm />
        </section>
      </div>
    </div>
  );
}
