'use client';

import { motion } from 'framer-motion';

const steps = [
    {
        number: '1',
        description: 'Scrivi la località o la spiaggia che ti interessa.'
    },
    {
        number: '2',
        description: 'Guardi i lidi vicini e il loro livello di affollamento.'
    },
    {
        number: '3',
        description: 'Scegli quello perfetto per te e aiuti gli altri con un tap.'
    }
];

export default function HowItWorks() {
    return (
        <section id="how-it-works" className="w-full bg-[#000006] text-white py-24 px-6 relative z-10 border-t border-white/[0.03]">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <motion.span
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-block mb-4 text-sm font-bold tracking-widest uppercase text-cyan-500"
                    >
                        Come funziona
                    </motion.span>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-3xl md:text-5xl font-black tracking-tighter"
                    >
                        Come scegliere meglio e aiutare la community in meno di un minuto.
                    </motion.h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {steps.map((step, index) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.5, delay: index * 0.15 }}
                            className="flex items-start gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/[0.05]"
                        >
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-black text-xl shadow-[inset_0_0_0_1px_rgba(34,211,238,0.2)]">
                                {step.number}
                            </div>
                            <p className="text-white/80 font-medium leading-relaxed pt-1">
                                {step.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
