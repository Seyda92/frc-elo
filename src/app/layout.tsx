import type { Metadata } from "next";
import { Archivo_Black, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${display.variable} ${body.variable}`}>
      <body className="bg-asphalt antialiased">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
