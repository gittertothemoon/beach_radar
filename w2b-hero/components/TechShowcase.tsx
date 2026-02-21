'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import Image from 'next/image';

export default function TechShowcase() {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
    const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

    return (
        <section ref={ref} className="block md:hidden w-full bg-[#000006] relative overflow-hidden py-12">
            {/* Ambient glow behind the image */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[300px] h-[500px] bg-cyan-500/8 rounded-full blur-[100px]" />
            </div>

            <motion.div
                style={{ y, opacity }}
                className="relative z-10 max-w-sm mx-auto px-4"
            >
                <Image
                    src="/decor-tech.png"
                    alt="Where 2 Beach — La tecnologia dietro il radar"
                    width={768}
                    height={1365}
                    className="w-full h-auto"
                    priority={false}
                />
            </motion.div>

            {/* Bottom fade-out into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#000006] to-transparent pointer-events-none" />
        </section>
    );
}
