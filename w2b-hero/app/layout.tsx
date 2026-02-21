import type { Metadata } from "next";
import localFont from "next/font/local";
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
  title: "Where 2 Beach — La spiaggia perfetta, trovata in un istante",
  description: "Dati in tempo reale su vento, onde, affollamento e meteo. Scopri dove andare prima di partire. Iscriviti alla lista d'attesa per l'accesso anticipato.",
  openGraph: {
    title: "Where 2 Beach — La spiaggia perfetta, trovata in un istante",
    description: "Dati in tempo reale su vento, onde, affollamento e meteo. Scopri dove andare prima di partire.",
    url: "https://www.where2beach.com",
    siteName: "Where 2 Beach",
    locale: "it_IT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Where 2 Beach — La spiaggia perfetta, trovata in un istante",
    description: "Dati in tempo reale su vento, onde, affollamento e meteo. Scopri dove andare prima di partire.",
  },
  metadataBase: new URL("https://www.where2beach.com"),
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
        {children}
      </body>
    </html>
  );
}
