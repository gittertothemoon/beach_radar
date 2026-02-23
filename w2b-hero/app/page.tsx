import type { Metadata } from 'next'
import Where2BeachSequence from '@/components/Where2BeachSequence'
import FeaturesGrid from '@/components/FeaturesGrid'
import TechShowcase from '@/components/TechShowcase'
import HowItWorks from '@/components/HowItWorks'
import WaitlistForm from '@/components/WaitlistForm'
import { Instagram } from 'lucide-react'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
}

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Where2Beach",
      url: "https://where2beach.com",
      logo: "https://where2beach.com/logo.png",
      sameAs: [
        "https://www.instagram.com/where2beach/",
        "https://www.tiktok.com/@where2beach",
      ],
    },
    {
      "@type": "WebSite",
      name: "Where2Beach",
      url: "https://where2beach.com",
      inLanguage: "it-IT",
    },
  ],
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.79a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="bg-[#000006] min-h-screen selection:bg-white/20 selection:text-white pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <h1 className="sr-only">Where2Beach: scopri la spiaggia perfetta in tempo reale</h1>

      <Where2BeachSequence />

      <div className="relative z-10 bg-[#000006]">
        <FeaturesGrid />
        <TechShowcase />
        <HowItWorks />
        <WaitlistForm />

        {/* Premium Footer */}
        <footer className="w-full border-t border-white/[0.06] bg-gradient-to-b from-[#000006] to-[#020210]">
          {/* Main Footer Content */}
          <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">

              {/* Brand Column */}
              <div className="md:col-span-1 flex flex-col gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Where 2 Beach" className="h-16 w-auto object-contain self-start" />
                <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                  La tua spiaggia perfetta, trovata in un istante. Dati in tempo reale, zero sorprese.
                </p>
                {/* Social Icons */}
                <div className="flex gap-3 mt-2">
                  <a href="https://www.instagram.com/where2beach/" target="_blank" rel="noopener noreferrer"
                    className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-gradient-to-br hover:from-purple-500/20 hover:via-pink-500/15 hover:to-orange-500/10 hover:border-pink-500/30 hover:shadow-[0_0_20px_rgba(236,72,153,0.12)] transition-all duration-500">
                    <Instagram className="w-5 h-5 text-white/40 group-hover:text-pink-400 transition-colors duration-300" />
                  </a>
                  <a href="https://www.tiktok.com/@where2beach" target="_blank" rel="noopener noreferrer"
                    className="group flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm hover:bg-gradient-to-br hover:from-cyan-500/20 hover:via-blue-500/15 hover:to-purple-500/10 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.12)] transition-all duration-500">
                    <TikTokIcon className="w-5 h-5 text-white/40 group-hover:text-cyan-400 transition-colors duration-300" />
                  </a>
                </div>
              </div>

              {/* Quick Links Column */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em] mb-1">Navigazione</h4>
                <a href="#features" className="text-sm text-white/35 hover:text-white/80 transition-colors duration-200">Funzionalità</a>
                <a href="#how-it-works" className="text-sm text-white/35 hover:text-white/80 transition-colors duration-200">Come Funziona</a>
                <a href="#waitlist" className="text-sm text-white/35 hover:text-white/80 transition-colors duration-200">Lista d&apos;Attesa</a>
              </div>

              {/* Legal Column */}
              <div className="flex flex-col gap-3">
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-[0.2em] mb-1">Legale</h4>
                <a href="/privacy" className="text-sm text-white/35 hover:text-white/80 transition-colors duration-200">Privacy Policy</a>
                <a href="/terms" className="text-sm text-white/35 hover:text-white/80 transition-colors duration-200">Termini di Servizio</a>
                <a href="mailto:info@where2beach.com" className="text-sm text-white/35 hover:text-white/80 transition-colors duration-200">Contattaci</a>
              </div>

            </div>
          </div>

          {/* Copyright Bar */}
          <div className="border-t border-white/[0.04] py-6 px-6">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-white/20 text-xs font-medium tracking-wider">
                © {new Date().getFullYear()} Where2Beach. Tutti i diritti riservati.
              </p>
              <p className="text-white/15 text-[10px] tracking-wider uppercase">
                Made with <span className="text-red-500/60 inline-block mx-0.5">♥</span> in Italy
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
