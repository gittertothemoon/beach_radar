'use client';

import { useScroll } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

type ScrollDirection = -1 | 0 | 1;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const PROGRESS_EPSILON = 0.0001;

function resolveFrameForDirection(
    frames: (HTMLImageElement | null)[],
    targetIndex: number,
    direction: ScrollDirection,
    fallbackIndex: number
) {
    const direct = frames[targetIndex];
    if (direct) {
        return { image: direct, index: targetIndex };
    }

    const count = frames.length;
    const preferredOffsetSign = direction < 0 ? 1 : -1;

    for (let radius = 1; radius < count; radius += 1) {
        const preferredIndex = targetIndex + preferredOffsetSign * radius;
        if (preferredIndex >= 0 && preferredIndex < count && frames[preferredIndex]) {
            return { image: frames[preferredIndex], index: preferredIndex };
        }

        const oppositeIndex = targetIndex - preferredOffsetSign * radius;
        if (oppositeIndex >= 0 && oppositeIndex < count && frames[oppositeIndex]) {
            return { image: frames[oppositeIndex], index: oppositeIndex };
        }
    }

    if (fallbackIndex >= 0 && fallbackIndex < count && frames[fallbackIndex]) {
        return { image: frames[fallbackIndex], index: fallbackIndex };
    }

    return { image: null, index: targetIndex };
}

export default function TechShowcase() {
    const ref = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameProgressRef = useRef(0);
    const scrollDirectionRef = useRef<ScrollDirection>(0);
    const lastDrawnFrameIndexRef = useRef(0);
    const framesRef = useRef<(HTMLImageElement | null)[]>(
        Array.from({ length: 240 }, () => null)
    );
    const [loadedCount, setLoadedCount] = useState(0);

    const FRAME_COUNT = 240;

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end end"]
    });

    useEffect(() => {
        let cancelled = false;
        const loaded = Array.from({ length: FRAME_COUNT }, () => null as HTMLImageElement | null);
        framesRef.current = loaded;
        let pendingCommit = false;
        let loadedSoFar = 0;
        let nextIndex = 0;
        const concurrency = 6;

        const loadFrames = async () => {
            const loadSingle = (index: number) =>
                new Promise<void>((resolve) => {
                    const image = new Image();
                    image.src = `/decor-sequence/frame_${index}.webp`;
                    image.onload = () => {
                        if (!cancelled) {
                            loaded[index] = image;
                            loadedSoFar += 1;

                            if (!pendingCommit) {
                                pendingCommit = true;
                                requestAnimationFrame(() => {
                                    pendingCommit = false;
                                    if (!cancelled) {
                                        setLoadedCount(loadedSoFar);
                                        window.dispatchEvent(new CustomEvent('w2b-tech-frame-loaded'));
                                    }
                                });
                            }
                        }
                        resolve();
                    };
                    image.onerror = () => {
                        if (!cancelled) {
                            loadedSoFar += 1;
                            if (!pendingCommit) {
                                pendingCommit = true;
                                requestAnimationFrame(() => {
                                    pendingCommit = false;
                                    if (!cancelled) {
                                        setLoadedCount(loadedSoFar);
                                        window.dispatchEvent(new CustomEvent('w2b-tech-frame-loaded'));
                                    }
                                });
                            }
                        }
                        resolve();
                    };
                });

            const worker = async () => {
                while (!cancelled) {
                    const index = nextIndex;
                    nextIndex += 1;
                    if (index >= FRAME_COUNT) return;
                    await loadSingle(index);
                }
            };

            await Promise.all(Array.from({ length: concurrency }, () => worker()));
        };

        loadFrames();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        let raf = 0;
        let pendingFrame = false;
        let disposed = false;
        let lastRenderKey = '';
        frameProgressRef.current = clamp01(scrollYProgress.get());

        const draw = () => {
            pendingFrame = false;
            if (disposed) return;

            const parent = canvas.parentElement;
            if (!parent) {
                return;
            }

            const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            const rect = parent.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width * dpr));
            const height = Math.max(1, Math.floor(rect.height * dpr));
            const resized = canvas.width !== width || canvas.height !== height;

            if (resized) {
                canvas.width = width;
                canvas.height = height;
                canvas.style.width = `${rect.width}px`;
                canvas.style.height = `${rect.height}px`;
            }

            const frameIndex = Math.min(
                FRAME_COUNT - 1,
                Math.max(0, Math.round(frameProgressRef.current * (FRAME_COUNT - 1)))
            );
            const { image, index: drawnIndex } = resolveFrameForDirection(
                framesRef.current,
                frameIndex,
                scrollDirectionRef.current,
                lastDrawnFrameIndexRef.current
            );
            const renderKey = `${drawnIndex}-${canvas.width}x${canvas.height}`;
            if (!resized && renderKey === lastRenderKey) return;
            lastRenderKey = renderKey;

            context.clearRect(0, 0, canvas.width, canvas.height);
            if (image) {
                lastDrawnFrameIndexRef.current = drawnIndex;
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
        };

        const requestDraw = () => {
            if (pendingFrame) return;
            pendingFrame = true;
            raf = requestAnimationFrame(draw);
        };

        const unsubscribe = scrollYProgress.on('change', (value) => {
            const clamped = clamp01(value);
            const previous = frameProgressRef.current;

            if (clamped > previous + PROGRESS_EPSILON) {
                scrollDirectionRef.current = 1;
            } else if (clamped < previous - PROGRESS_EPSILON) {
                scrollDirectionRef.current = -1;
            }

            frameProgressRef.current = clamped;
            requestDraw();
        });

        requestDraw();
        window.addEventListener('resize', requestDraw);
        window.addEventListener('orientationchange', requestDraw);
        window.addEventListener('w2b-tech-frame-loaded', requestDraw as EventListener);

        return () => {
            disposed = true;
            unsubscribe();
            window.removeEventListener('resize', requestDraw);
            window.removeEventListener('orientationchange', requestDraw);
            window.removeEventListener('w2b-tech-frame-loaded', requestDraw as EventListener);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [scrollYProgress]);

    return (
        <section ref={ref} className="block md:hidden relative w-full h-[220svh] bg-[#000006]">
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
                    {loadedCount === 0 && (
                        <div className="absolute inset-0 animate-pulse bg-black/30" />
                    )}
                </div>
            </div>

            {/* Bottom fade-out into next section */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#000006] to-transparent pointer-events-none" />
        </section>
    );
}
