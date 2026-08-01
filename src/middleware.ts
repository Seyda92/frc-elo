import { NextResponse, type NextRequest } from "next/server";

/**
 * Gemeinsamer Basic-Auth-Türsteher für die Testinstanz — unabhängig von den
 * individuellen /admin-Logins in src/lib/auth.ts. Nur aktiv, wenn
 * BASIC_AUTH_USER/BASIC_AUTH_PASS gesetzt sind, damit lokale Entwicklung und
 * ein späteres Production-Deploy ohne Basic-Auth nicht versehentlich
 * ausgesperrt werden.
 *
 * Kein node:crypto hier — Middleware läuft in der Edge-Runtime, die das
 * nicht unterstützt (Build bricht sonst mit "Import trace: node:crypto" ab).
 * Ein simpler Vergleich reicht für diesen Zweck (Testinstanz, kein
 * sicherheitskritisches Ziel für Timing-Angriffe).
 */

function safeEqual(a: string, b: string): boolean {
  return a === b;
}

export function middleware(request: NextRequest) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;
  if (!expectedUser || !expectedPass) return NextResponse.next();

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex >= 0) {
      const user = decoded.slice(0, separatorIndex);
      const pass = decoded.slice(separatorIndex + 1);
      if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentifizierung erforderlich", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="frc-elo Testinstanz"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
