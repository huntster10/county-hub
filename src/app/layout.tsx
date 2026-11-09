import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "County Hub", template: "%s · County Hub" },
  description: "Community hub for an Emergency Response: Liberty County private server.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
