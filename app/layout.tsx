import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drawer — your receipts, tucked away",
  description: "A kinder little home for your receipts and everyday spending.",
  applicationName: "Drawer",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
