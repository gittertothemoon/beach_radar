'use client';

import { useScroll } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export default function TechShowcase() {
    const ref = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameProgressRef = useRef(0);
    const [frames, setFrames] = useState<HTMLImageElement[]>([]);

    const FRAME_COUNT = 240;

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end end"]
    });

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
        <section ref={ref} className="block md:hidden relative w-full h-[220svh] bg-[#000006] overflow-hidden">
            <div className="sticky top-0 h-[100svh] w-full overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#040412] via-[#000006] to-[#000006]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[65vw] h-[65vh] bg-cyan-500/10 rounded-full blur-[120px]" />
                    </div>
                </div>

                <div className="relative z-10 h-full w-full">
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        aria-label="Where 2 Beach - Tech visual sequence"
                    />
                    {frames.length === 0 && (
                        <div className="absolute inset-0 animate-pulse bg-black/30" />
                    )}
                </div>
            </div>

            {/* Bottom fade-out into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#000006] to-transparent pointer-events-none" />
        </section>
    );
}
