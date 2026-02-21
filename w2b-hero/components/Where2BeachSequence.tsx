'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useScroll, useSpring, motion, useTransform, MotionValue } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function Where2BeachSequence() {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameProgressRef = useRef(0);

    const [isMobileView, setIsMobileView] = useState(false);
    const [frames, setFrames] = useState<(HTMLImageElement | null)[]>([]);
    const [loadedCount, setLoadedCount] = useState(0);
    const [frameTotal, setFrameTotal] = useState(0);
    const [isReady, setIsReady] = useState(false);

    const DESKTOP_COUNT = 120;
    const MOBILE_COUNT = 240;

    // Scroll mapping
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end end'],
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    // Prevent scroll restoration on reload
    useEffect(() => {
        if ('scrollRestoration' in history) {
            history.scrollRestoration = 'manual';
        }
        window.scrollTo(0, 0);
    }, []);

    // Track viewport mode so mobile doesn't allocate desktop 4K sequence.
    useEffect(() => {
        const updateViewportMode = () => {
            setIsMobileView(window.innerWidth < 768);
        };
        updateViewportMode();
        window.addEventListener('resize', updateViewportMode);
        window.addEventListener('orientationchange', updateViewportMode);

        return () => {
            window.removeEventListener('resize', updateViewportMode);
            window.removeEventListener('orientationchange', updateViewportMode);
        };
    }, []);

    // Progressive loading with limited concurrency to avoid Safari memory spikes.
    useEffect(() => {
        let isCancelled = false;
        const activeCount = isMobileView ? MOBILE_COUNT : DESKTOP_COUNT;
        const sequencePath = isMobileView ? '/sequence/mobile' : '/sequence';
        const concurrency = isMobileView ? 6 : 4;
        const readyThreshold = isMobileView ? 16 : 10;

        const loadImages = async () => {
            setIsReady(false);
            setLoadedCount(0);
            setFrameTotal(activeCount);

            const loaded = Array.from({ length: activeCount }, () => null as HTMLImageElement | null);
            setFrames(loaded);

            let nextIndex = 0;
            let loadedSoFar = 0;
            let readyRaised = false;
            let commitQueued = false;

            const commit = () => {
                if (commitQueued) return;
                commitQueued = true;
                requestAnimationFrame(() => {
                    commitQueued = false;
                    if (isCancelled) return;
                    setFrames([...loaded]);
                    setLoadedCount(loadedSoFar);
                    if (!readyRaised && loadedSoFar >= readyThreshold) {
                        readyRaised = true;
                        setIsReady(true);
                    }
                });
            };

            const loadSingleImage = (index: number) =>
                new Promise<void>((resolve) => {
                    const img = new Image();
                    img.src = `${sequencePath}/frame_${index}.webp`;
                    img.onload = () => {
                        if (!isCancelled) {
                            loaded[index] = img;
                            loadedSoFar += 1;
                            commit();
                        }
                        resolve();
                    };
                    img.onerror = () => {
                        if (!isCancelled) {
                            loadedSoFar += 1;
                            commit();
                        }
                        resolve();
                    };
                });

            const worker = async () => {
                while (!isCancelled) {
                    const index = nextIndex;
                    nextIndex += 1;
                    if (index >= activeCount) return;
                    await loadSingleImage(index);
                }
            };

            await Promise.all(Array.from({ length: concurrency }, () => worker()));

            if (!isCancelled) {
                setFrames([...loaded]);
                setLoadedCount(loadedSoFar);
                setIsReady(true);
            }
        };

        loadImages();

        return () => {
            isCancelled = true;
        };
    }, [isMobileView]);

    // Animation logic
    useEffect(() => {
        if (!isReady || frames.length === 0) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId = 0;
        let pendingFrame = false;
        let disposed = false;
        let lastRenderKey = '';
        frameProgressRef.current = Math.min(1, Math.max(0, scrollYProgress.get()));

        const draw = () => {
            pendingFrame = false;
            if (disposed) return;

            const parent = canvas.parentElement;
            if (parent) {
                const dpr = Math.min(window.devicePixelRatio || 1, isMobileView ? 1.5 : 2);
                const rect = parent.getBoundingClientRect();
                const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
                const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
                const resized = canvas.width !== nextWidth || canvas.height !== nextHeight;

                if (resized) {
                    canvas.width = nextWidth;
                    canvas.height = nextHeight;
                    canvas.style.width = `${rect.width}px`;
                    canvas.style.height = `${rect.height}px`;
                }

                const activeImages = frames;
                const activeCount = frames.length;
                if (activeCount === 0) return;

                const currentFrameIndex = Math.min(
                    activeCount - 1,
                    Math.max(0, Math.round(frameProgressRef.current * (activeCount - 1)))
                );
                const renderKey = `${isMobileView ? 'm' : 'd'}-${currentFrameIndex}-${canvas.width}x${canvas.height}`;
                if (!resized && renderKey === lastRenderKey) return;
                lastRenderKey = renderKey;

                let img = activeImages[currentFrameIndex];
                if (!img) {
                    for (let radius = 1; radius < activeCount; radius += 1) {
                        const previous = currentFrameIndex - radius;
                        if (previous >= 0 && activeImages[previous]) {
                            img = activeImages[previous];
                            break;
                        }
                        const next = currentFrameIndex + radius;
                        if (next < activeCount && activeImages[next]) {
                            img = activeImages[next];
                            break;
                        }
                    }
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (img) {
                    const canvasAspect = canvas.width / canvas.height;
                    const imgAspect = img.width / img.height;

                    let drawWidth, drawHeight, offsetX, offsetY;

                    if (isMobileView) {
                        // Mobile: Object-fit COVER behavior
                        // We want the vertical mobile frame to fill the entire height/width of the canvas without blank space.
                        // It will zoom in to cover gaps.
                        if (imgAspect > canvasAspect) {
                            // Image is wider than canvas relative to height
                            drawHeight = canvas.height;
                            drawWidth = canvas.height * imgAspect;
                            offsetX = (canvas.width - drawWidth) / 2;
                            offsetY = 0;
                        } else {
                            // Image is taller than canvas relative to width
                            drawWidth = canvas.width;
                            drawHeight = canvas.width / imgAspect;
                            offsetX = 0;
                            offsetY = (canvas.height - drawHeight) / 2;
                        }
                    } else {
                        // Desktop: Object-fit CONTAIN behavior
                        // We want the horizontal desktop frame to fit entirely inside the canvas without cropping.
                        if (imgAspect > canvasAspect) {
                            drawWidth = canvas.width;
                            drawHeight = canvas.width / imgAspect;
                            offsetX = 0;
                            offsetY = (canvas.height - drawHeight) / 2;
                        } else {
                            drawHeight = canvas.height;
                            drawWidth = canvas.height * imgAspect;
                            offsetX = (canvas.width - drawWidth) / 2;
                            offsetY = 0;
                        }
                    }

                    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
                }
            }
        };

        const requestDraw = () => {
            if (pendingFrame) return;
            pendingFrame = true;
            animationFrameId = requestAnimationFrame(draw);
        };

        const unsubscribe = scrollYProgress.on('change', (value) => {
            frameProgressRef.current = Math.min(1, Math.max(0, value));
            requestDraw();
        });

        requestDraw();
        window.addEventListener('resize', requestDraw);
        window.addEventListener('orientationchange', requestDraw);

        return () => {
            disposed = true;
            unsubscribe();
            window.removeEventListener('resize', requestDraw);
            window.removeEventListener('orientationchange', requestDraw);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [frames, isMobileView, isReady, scrollYProgress]);

    return (
        <div ref={containerRef} className="relative h-[400svh] md:h-[400vh] w-full bg-[#000006]" style={{ position: 'relative' }}>
            {/* Combined Loading State */}
            {!isReady && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#000006]">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse" />
                        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin relative z-10" />
                    </div>
                    <p className="mt-6 text-white/50 text-sm font-medium tracking-widest flex flex-col items-center gap-2">
                        <span className="uppercase">Calibrando il Radar</span>
                        <span className="text-cyan-400/80 font-mono text-xs">
                            {Math.round((loadedCount / Math.max(1, frameTotal)) * 100)}%
                        </span>
                    </p>
                </div>
            )}

            {/* Sticky Canvas Container */}
            <div className="sticky top-0 h-[100svh] md:h-screen w-full overflow-hidden pointer-events-none">
                <canvas ref={canvasRef} className="w-full h-full object-contain pointer-events-none" />

                {/* Scroll To Explore Indicator */}
                <ScrollIndicator progress={smoothProgress} />

                {/* Scrollytelling Beats */}
                {isReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center font-sans tracking-tight">
                        <Beat
                            progress={smoothProgress}
                            range={[0, 0.1, 0.15, 0.25]}
                            title="LA SPIAGGIA PERFETTA ESISTE."
                            subtitle="Smetti di perdere tempo. Scopri dove andare prima di partire."
                            align="center"
                        />
                        <Beat
                            progress={smoothProgress}
                            range={[0.25, 0.35, 0.45, 0.55]}
                            title="DATI IN TEMPO REALE"
                            subtitle="Vento, onde, affollamento e meteo: tutto aggiornato al secondo."
                            align="left"
                        />
                        <Beat
                            progress={smoothProgress}
                            range={[0.5, 0.6, 0.7, 0.8]}
                            title="ZERO SORPRESE"
                            subtitle="Scegli la spiaggia giusta al primo colpo. Ogni volta."
                            align="right"
                        />
                        <Beat
                            progress={smoothProgress}
                            range={[0.75, 0.85, 1, 1]}
                            title="ACCESSO ANTICIPATO GRATUITO"
                            subtitle="Iscriviti ora e sarai tra i primi a provarlo."
                            align="center"
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------

function Beat({
    progress,
    range,
    title,
    subtitle,
    align
}: {
    progress: MotionValue<number>,
    range: [number, number, number, number],
    title: string,
    subtitle: string,
    align: 'left' | 'center' | 'right'
}) {
    const [start, enterEnd, exitStart, end] = range;

    const opacity = useTransform(progress, [start, enterEnd, exitStart, end], [0, 1, 1, 0]);
    const y = useTransform(progress, [start, enterEnd, exitStart, end], [20, 0, 0, -20]);

    const alignmentClass =
        align === 'left' ? 'items-start text-left left-8 md:left-24' :
            align === 'right' ? 'items-end text-right right-8 md:right-24' :
                'items-center text-center inset-x-0';

    return (
        <motion.div
            className={`absolute flex flex-col justify-center px-6 md:px-0 ${alignmentClass}`}
            style={{ opacity, y }}
        >
            <h2 className="text-4xl md:text-8xl font-black text-white mb-4 md:mb-6 tracking-tighter leading-none"
                style={{ textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.7), 0 0px 8px rgba(0,0,0,1)' }}>
                {title}
            </h2>
            <p className="text-lg md:text-2xl text-white/95 font-semibold tracking-tight max-w-lg leading-snug"
                style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0px 6px rgba(0,0,0,1)' }}>
                {subtitle}
            </p>
        </motion.div>
    );
}

function ScrollIndicator({ progress }: { progress: MotionValue<number> }) {
    const opacity = useTransform(progress, [0, 0.1], [1, 0]);

    return (
        <motion.div
            className="absolute bottom-12 inset-x-0 flex flex-col items-center justify-center text-white/40 tracking-widest text-xs uppercase"
            style={{ opacity }}
        >
            <div className="mb-2">Scorri per esplorare</div>
            <div className="w-[1px] h-8 bg-white/20 relative overflow-hidden">
                <motion.div
                    className="absolute top-0 left-0 w-full h-1/2 bg-white/60"
                    animate={{ y: [0, 32] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                />
            </div>
        </motion.div>
    );
}
