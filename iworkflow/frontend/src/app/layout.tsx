import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-sans-vn",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "iWorkflow 2.0 – Wireframe",
  description: "Wireframe giao diện iWorkflow phiên bản mới (Next.js) để duyệt",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
