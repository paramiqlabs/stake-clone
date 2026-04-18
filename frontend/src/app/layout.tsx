import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crash Betting Platform",
  description: "Basic crash betting frontend",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}

