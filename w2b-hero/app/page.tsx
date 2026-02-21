import Where2BeachSequence from '@/components/Where2BeachSequence'
import FeaturesGrid from '@/components/FeaturesGrid'
import HowItWorks from '@/components/HowItWorks'
import WaitlistForm from '@/components/WaitlistForm'
import { Instagram } from 'lucide-react'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91.04 0 1.25.17 2.49.52 3.65.65 2.14 2 4.04 3.86 5.4 1.35 1 2.94 1.63 4.63 1.83v4.06c-1.63-.09-3.23-.48-4.71-1.12-1.39-.61-2.65-1.46-3.7-2.52v7.19c.01 2.37-.88 4.65-2.51 6.35-1.63 1.71-3.87 2.68-6.23 2.68-2.36 0-4.6-.97-6.23-2.68-1.64-1.7-2.52-3.98-2.51-6.35.01-2.37.88-4.65 2.51-6.35 1.63-1.71 3.87-2.68 6.23-2.68.73.01 1.45.1 2.15.28v4.18c-.7-.18-1.43-.27-2.15-.28-1.25 0-2.43.51-3.3 1.42-.87.91-1.34 2.13-1.33 3.39 0 1.25.46 2.48 1.33 3.39.87.91 2.05 1.42 3.3 1.42 1.24 0 2.42-.51 3.29-1.42.87-.91 1.33-2.14 1.32-3.39V0h3.62z" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="bg-[#000006] min-h-screen selection:bg-white/20 selection:text-white pb-12">
      <Where2BeachSequence />

      <div className="relative z-10 bg-[#000006]">
        <FeaturesGrid />
        <HowItWorks />
        <WaitlistForm />

        {/* Premium Footer */}
        <footer className="w-full border-t border-white/[0.06] bg-gradient-to-b from-[#000006] to-[#020210]">
          {/* Main Footer Content */}
          <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">

              {/* Brand Column */}
              <div className="md:col-span-1 flex flex-col gap-4">
                <img src="/logo.png" alt="Where 2 Beach" className="h-16 w-auto object-contain self-start" />
                <p className="text-white/40 text-sm leading-relaxed max-w-xs">
                  La tua spiaggia perfetta, trovata in un istante. Dati in tempo reale, zero sorprese.
                </p>
                {/* Social Icons */}
                <div className="flex gap-4 mt-2">
                  <a href="https://www.instagram.com/where2beach/" target="_blank" rel="noopener noreferrer"
                    className="group flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-gradient-to-br hover:from-purple-500/20 hover:to-pink-500/20 hover:border-pink-500/30 transition-all duration-300">
                    <Instagram className="w-4 h-4 text-white/50 group-hover:text-pink-400 transition-colors" />
                  </a>
                  <a href="https://www.tiktok.com/@where2beach" target="_blank" rel="noopener noreferrer"
                    className="group flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-gradient-to-br hover:from-cyan-500/20 hover:to-blue-500/20 hover:border-cyan-500/30 transition-all duration-300">
                    <TikTokIcon className="w-4 h-4 text-white/50 group-hover:text-cyan-400 transition-colors" />
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
                © {new Date().getFullYear()} Where 2 Beach. Tutti i diritti riservati.
              </p>
              <p className="text-white/15 text-[10px] tracking-wider uppercase">
                Made with 🌊 in Italia
              </p>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
