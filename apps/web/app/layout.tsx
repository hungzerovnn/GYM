import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Plus_Jakarta_Sans, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/lib/app-providers";
import { defaultLocale, isSupportedLocale, localeCookieKey } from "@/lib/i18n/runtime";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-sans",
});

const mono = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "FitFlow Enterprise",
  description: "Multi-branch fitness center management platform",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const storedLocale = cookieStore.get(localeCookieKey)?.value;
  const initialLocale = isSupportedLocale(storedLocale) ? storedLocale : defaultLocale;

  return (
    <html lang={initialLocale} suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable}`}>
        <AppProviders initialLocale={initialLocale}>{children}</AppProviders>
      </body>
    </html>
  );
}
