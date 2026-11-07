import type { Metadata } from "next";
import { LanguageProvider } from "@/lib/language";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meryy Interview Studio",
  description: "A thoughtful space to practise for interviews, prepare for opportunities, and review your recordings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
