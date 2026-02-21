'use client';

import { motion } from 'framer-motion';
import { RefreshCw, Map, Users } from 'lucide-react';

const features = [
    {
        icon: RefreshCw,
        title: 'Se vuoi tranquillità',
        description: 'Trovi rapidamente i lidi meno affollati e ti rilassi da subito senza stress.',
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'hover:border-cyan-500/20',
        glow: 'hover:shadow-[0_0_30px_rgba(34,211,238,0.08)]',
    },
    {
        icon: Map,
        title: 'Se vuoi più vita',
        description: 'Individui subito le zone più movimentate quando cerchi energia e divertimento.',
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'hover:border-purple-500/20',
        glow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.08)]',
    },
    {
        icon: Users,
        title: 'La community fa la differenza',
        description: 'Ogni segnalazione sull&apos;affollamento rende la scelta più chiara per tutti.',
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'hover:border-amber-500/20',
        glow: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.08)]',
    }
];

export default function FeaturesGrid() {
    return (
        <section id="features" className="w-full bg-[#000006] text-white py-32 px-6">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-20">
                    <motion.h3
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6 }}
                        className="text-4xl md:text-5xl font-black mb-6 tracking-tighter"
                    >
                        TI FA RISPARMIARE TEMPO<br />E VIVERE MEGLIO LA GIORNATA.
                    </motion.h3>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-white/60 text-lg md:text-xl max-w-2xl mx-auto tracking-tight"
                    >
                        Non devi più girare tra spiagge troppo piene o troppo vuote. Confronti i lidi prima di partire e scegli quello con l&apos;affollamento più adatto a te.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={feature.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.6, delay: index * 0.15 }}
                            className={`flex flex-col items-start p-8 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-all duration-300 ${feature.border} ${feature.glow}`}
                        >
                            <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-6`}>
                                <feature.icon className={`w-6 h-6 ${feature.color}`} />
                            </div>
                            <h4 className="text-xl font-bold mb-3 tracking-tight">{feature.title}</h4>
                            <p className="text-white/50 leading-relaxed font-medium">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
