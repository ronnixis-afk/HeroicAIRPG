import type { Metadata } from "next";
import { Merriweather_Sans, Merriweather } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const merriweatherSans = Merriweather_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const merriweather = Merriweather({
  variable: "--font-merriweather",
  weight: ["300", "400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gemini Adventure GM",
  description: "AI-powered RPG experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${merriweatherSans.variable} ${merriweather.variable} h-full`}>
        <body className="h-full overflow-hidden font-sans">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
