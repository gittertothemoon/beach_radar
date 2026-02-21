'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export default function TechShowcase() {
    const ref = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameProgressRef = useRef(0);
    const [frames, setFrames] = useState<HTMLImageElement[]>([]);

    const FRAME_COUNT = 240;

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], [40, -40]);
    const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

    useEffect(() => {
        let cancelled = false;

        const loadFrames = async () => {
            const loaded: HTMLImageElement[] = [];

            const loadSingle = (index: number) =>
                new Promise<void>((resolve) => {
                    const image = new Image();
                    image.src = `/decor-sequence/frame_${index}.webp`;
                    image.onload = () => {
                        if (!cancelled) loaded[index] = image;
                        resolve();
                    };
                    image.onerror = () => resolve();
                });

            await Promise.all(
                Array.from({ length: FRAME_COUNT }).map((_, index) => loadSingle(index))
            );

            if (!cancelled) {
                setFrames(loaded.filter(Boolean));
            }
        };

        loadFrames();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (frames.length === 0) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        let raf = 0;
        frameProgressRef.current = Math.min(1, Math.max(0, scrollYProgress.get()));

        const render = () => {
            const parent = canvas.parentElement;
            if (!parent) {
                raf = requestAnimationFrame(render);
                return;
            }

            const dpr = window.devicePixelRatio || 1;
            const rect = parent.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width * dpr));
            const height = Math.max(1, Math.floor(rect.height * dpr));

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
            }

            const target = Math.min(1, Math.max(0, scrollYProgress.get()));
            frameProgressRef.current += (target - frameProgressRef.current) * 0.2;
            if (Math.abs(target - frameProgressRef.current) < 0.0005) {
                frameProgressRef.current = target;
            }

            const frameIndex = Math.min(
                frames.length - 1,
                Math.max(0, Math.round(frameProgressRef.current * (frames.length - 1)))
            );
            const image = frames[frameIndex];

            context.clearRect(0, 0, canvas.width, canvas.height);
            if (image) {
                const canvasAspect = canvas.width / canvas.height;
                const imageAspect = image.width / image.height;

                let drawWidth = 0;
                let drawHeight = 0;
                let x = 0;
                let yOffset = 0;

                if (imageAspect > canvasAspect) {
                    drawHeight = canvas.height;
                    drawWidth = canvas.height * imageAspect;
                    x = (canvas.width - drawWidth) / 2;
                } else {
                    drawWidth = canvas.width;
                    drawHeight = canvas.width / imageAspect;
                    yOffset = (canvas.height - drawHeight) / 2;
                }

                context.drawImage(image, x, yOffset, drawWidth, drawHeight);
            }

            raf = requestAnimationFrame(render);
        };

        render();
        return () => cancelAnimationFrame(raf);
    }, [frames, scrollYProgress]);

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
                <div className="relative w-full aspect-[4/7] overflow-hidden rounded-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        aria-label="Where 2 Beach - Tech visual sequence"
                    />
                    {frames.length === 0 && (
                        <div className="absolute inset-0 animate-pulse bg-white/[0.04]" />
                    )}
                </div>
            </motion.div>

            {/* Bottom fade-out into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#000006] to-transparent pointer-events-none" />
        </section>
    );
}
