import type { Metadata } from "next";
import localFont from "next/font/local";
import WebViewClassGate from "@/components/WebViewClassGate";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Where2Beach — La spiaggia perfetta, trovata in un istante",
  description: "Dati in tempo reale su vento, onde, affollamento e meteo. Scopri dove andare prima di partire. Iscriviti alla lista d'attesa per l'accesso anticipato.",
  applicationName: "Where2Beach",
  keywords: [
    "where2beach",
    "where 2 beach",
    "spiagge",
    "affollamento spiagge",
    "meteo spiaggia",
    "lidi",
  ],
  authors: [{ name: "Where2Beach", url: "https://where2beach.com" }],
  creator: "Where2Beach",
  icons: {
    icon: [
      { url: "/favicon-32x32.png?v=20260222", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=20260222", sizes: "16x16", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon-32x32.png?v=20260222", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png?v=20260222", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Where2Beach — La spiaggia perfetta, trovata in un istante",
    description: "Dati in tempo reale su vento, onde, affollamento e meteo. Scopri dove andare prima di partire.",
    url: "https://where2beach.com",
    siteName: "Where2Beach",
    locale: "it_IT",
    type: "website",
    images: [
      {
        url: "/og/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Where2Beach",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Where2Beach — La spiaggia perfetta, trovata in un istante",
    description: "Dati in tempo reale su vento, onde, affollamento e meteo. Scopri dove andare prima di partire.",
    images: ["/og/og-default.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  metadataBase: new URL("https://where2beach.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WebViewClassGate />
        {children}
      </body>
    </html>
  );
}
