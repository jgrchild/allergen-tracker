import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Allergen Tracker",
  description: "A local-first food exposure tracker for family care plans.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
