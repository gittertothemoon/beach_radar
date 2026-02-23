import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Termini di Servizio — Where2Beach',
    description: 'Termini e condizioni di utilizzo di Where2Beach.',
    alternates: {
        canonical: '/terms',
    },
};

export default function TermsOfService() {
    return (
        <main className="bg-[#000006] min-h-screen text-white">
            <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
                {/* Back link */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/80 transition-colors mb-12">
                    <ArrowLeft className="w-4 h-4" />
                    Torna alla Home
                </Link>

                <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">Termini di Servizio</h1>
                <p className="text-white/30 text-sm mb-12">Ultimo aggiornamento: 21 febbraio 2025</p>

                <div className="space-y-10 text-white/70 text-[15px] leading-relaxed">

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">1. Accettazione dei Termini</h2>
                        <p>
                            Accedendo e utilizzando il sito web <strong className="text-white/90">where2beach.com</strong> (&quot;Servizio&quot;),
                            accetti di essere vincolato dai presenti Termini di Servizio. Se non accetti questi termini,
                            ti preghiamo di non utilizzare il Servizio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">2. Descrizione del Servizio</h2>
                        <p>
                            Where 2 Beach è una piattaforma in fase di sviluppo che fornirà informazioni in tempo reale
                            sulle condizioni delle spiagge, includendo dati su meteo, affollamento, vento e onde.
                            Attualmente il Servizio è in fase di <strong className="text-white/90">pre-lancio</strong> e
                            offre esclusivamente la possibilità di iscriversi alla lista d&apos;attesa.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">3. Iscrizione alla Lista d&apos;Attesa</h2>
                        <p>Iscrivendoti alla lista d&apos;attesa:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2 mt-2">
                            <li>Confermi di avere almeno 16 anni di età.</li>
                            <li>Fornisci un indirizzo email valido e di tua proprietà.</li>
                            <li>Acconsenti a ricevere comunicazioni relative al lancio del servizio.</li>
                            <li>Puoi richiedere la cancellazione in qualsiasi momento scrivendo a{' '}
                                <a href="mailto:info@where2beach.com" className="text-cyan-400 hover:underline">info@where2beach.com</a>.
                            </li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">4. Proprietà Intellettuale</h2>
                        <p>
                            Tutti i contenuti presenti sul sito — inclusi testi, grafica, loghi, animazioni, immagini e software —
                            sono di proprietà esclusiva di Where 2 Beach e sono protetti dalle leggi sul diritto d&apos;autore
                            e sulla proprietà intellettuale. È vietata qualsiasi riproduzione non autorizzata.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">5. Limitazione di Responsabilità</h2>
                        <p>
                            Il Servizio viene fornito &quot;così com&apos;è&quot; e &quot;come disponibile&quot;. Where 2 Beach non garantisce che il
                            Servizio sarà ininterrotto, privo di errori o sicuro. In nessun caso Where 2 Beach sarà
                            responsabile per danni diretti, indiretti, incidentali o consequenziali derivanti dall&apos;uso
                            del Servizio.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">6. Modifiche ai Termini</h2>
                        <p>
                            Ci riserviamo il diritto di modificare i presenti Termini di Servizio in qualsiasi momento.
                            Le modifiche entreranno in vigore al momento della pubblicazione su questa pagina.
                            L&apos;uso continuato del Servizio dopo la pubblicazione delle modifiche costituisce accettazione
                            dei nuovi termini.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">7. Legge Applicabile</h2>
                        <p>
                            I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia sarà competente
                            il Foro del luogo di residenza del consumatore, ai sensi del Codice del Consumo.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-bold text-white mb-3">8. Contatti</h2>
                        <p>
                            Per qualsiasi domanda relativa ai presenti Termini di Servizio, puoi contattarci a{' '}
                            <a href="mailto:info@where2beach.com" className="text-cyan-400 hover:underline">info@where2beach.com</a>.
                        </p>
                    </section>

                </div>
            </div>
        </main>
    );
}
