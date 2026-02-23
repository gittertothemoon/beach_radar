import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Privacy Policy — Where2Beach',
    description: 'Informativa sulla privacy di Where2Beach.',
    alternates: {
        canonical: '/privacy',
    },
};

export default function PrivacyPolicy() {
    return (
        <main className="bg-[#000006] min-h-screen text-white">
            <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
                {/* Back link */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors mb-12">
                    <ArrowLeft className="w-4 h-4" />
                    Torna alla Home
                </Link>

                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">Privacy Policy</h1>
                <p className="text-white/30 text-sm mb-12">Ultimo aggiornamento: 21 febbraio 2025</p>

                <div className="space-y-10 text-white/70 text-[15px] leading-relaxed">

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Titolare del Trattamento</h2>
                        <p>
                            Il titolare del trattamento dei dati personali è <strong className="text-white/90">Where 2 Beach</strong>,
                            contattabile all&apos;indirizzo email{' '}
                            <a href="mailto:info@where2beach.com" className="text-cyan-400 hover:underline">info@where2beach.com</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Dati Raccolti</h2>
                        <p className="mb-3">Raccogliamo esclusivamente i seguenti dati personali:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong className="text-white/90">Indirizzo email</strong> — fornito volontariamente tramite il modulo di iscrizione alla lista d&apos;attesa.</li>
                        </ul>
                        <p className="mt-3">Non raccogliamo dati di navigazione, cookie di profilazione o informazioni di pagamento.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Finalità del Trattamento</h2>
                        <p>I dati raccolti vengono utilizzati esclusivamente per:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                            <li>Gestire l&apos;iscrizione alla lista d&apos;attesa.</li>
                            <li>Inviare comunicazioni relative al lancio e agli aggiornamenti del servizio Where 2 Beach.</li>
                            <li>Contattarti in caso di accesso anticipato o promozioni dedicate.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Base Giuridica</h2>
                        <p>
                            Il trattamento dei dati si basa sul <strong className="text-white/90">consenso</strong> dell&apos;utente,
                            espresso al momento dell&apos;iscrizione alla lista d&apos;attesa (Art. 6, par. 1, lett. a del GDPR).
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Conservazione dei Dati</h2>
                        <p>
                            I dati personali saranno conservati fino al lancio ufficiale del servizio o fino alla richiesta di
                            cancellazione da parte dell&apos;utente, a seconda di quale evento si verifichi per primo.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Condivisione dei Dati</h2>
                        <p>
                            I dati personali <strong className="text-white/90">non vengono venduti, ceduti o condivisi</strong> con terze parti
                            per finalità di marketing. I dati sono conservati su infrastruttura{' '}
                            <strong className="text-white/90">Supabase</strong> (conforme al GDPR) e il sito è ospitato su{' '}
                            <strong className="text-white/90">Vercel</strong>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Diritti dell&apos;Utente</h2>
                        <p className="mb-2">In conformità al GDPR, hai il diritto di:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Accedere ai tuoi dati personali.</li>
                            <li>Richiedere la rettifica o la cancellazione dei tuoi dati.</li>
                            <li>Revocare il consenso in qualsiasi momento.</li>
                            <li>Presentare un reclamo all&apos;Autorità Garante per la protezione dei dati personali.</li>
                        </ul>
                        <p className="mt-3">
                            Per esercitare i tuoi diritti, scrivi a{' '}
                            <a href="mailto:info@where2beach.com" className="text-cyan-400 hover:underline">info@where2beach.com</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Modifiche alla Privacy Policy</h2>
                        <p>
                            Ci riserviamo il diritto di aggiornare questa informativa. Eventuali modifiche saranno
                            pubblicate su questa pagina con la data di ultimo aggiornamento.
                        </p>
                    </section>

                </div>
            </div>
        </main>
    );
}
