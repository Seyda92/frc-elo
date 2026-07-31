import type { Metadata } from "next";
import { Archivo_Black, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import { getSession } from "@/lib/auth";
import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "1. FRC ELO",
    template: "%s · 1. FRC ELO",
  },
  description:
    "ELO, Trefferquote und Bonusbiere – die spielerische Rangliste des 1. Flunky Reifen Clubs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Hinweis: cookies() im Root-Layout macht ALLE Routen dynamisch (auch das
  // öffentliche Leaderboard) — der Full Route Cache ist damit app-weit aus.
  // Unkritisch hier, da diese Seiten ohnehin pro Aufruf die DB befragen.
  const session = await getSession();

  return (
    <html lang="de" className={`${display.variable} ${body.variable}`}>
      <body className="bg-asphalt antialiased">
        <SiteHeader
          user={session ? { username: session.username, role: session.role } : null}
        />
        <main>{children}</main>
      </body>
    </html>
  );
}
