import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jev / Playground",
  description:
    "Explore typed decisions with TypeSafe AI. One state, independent questions, structured answers.",
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
