import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata = {
  title: "AI Tutor — Personalised Learning for Class 6–12",
  description:
    "AI-powered adaptive tutor for government school students in India. Personalized curriculum, instant feedback, and progress tracking.",
  keywords: ["AI tutor", "NCERT", "Class 6-12", "government school", "adaptive learning", "India"],
  authors: [{ name: "AI Tutor Team" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Tutor",
  },
  openGraph: {
    title: "AI Tutor — Personalised Learning for Class 6–12",
    description: "World-class AI tutoring for every Indian government school student.",
    type: "website",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f97316",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-stone-50 text-stone-900 antialiased font-body">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
