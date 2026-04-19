import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stake Clone",
  description: "Betting platform frontend",
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
