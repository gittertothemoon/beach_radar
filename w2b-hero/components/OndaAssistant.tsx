'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { Sparkles, X, ChevronRight } from 'lucide-react';

const MESSAGES = {
    hero: "La tua futura assistente. Richiedi accesso in anteprima!",
    features: "Sapevi che analizziamo la qualità dell'acqua in tempo reale?",
    howItWorks: "Trovare la tua oasi è semplicissimo. Ti va di provare in anteprima?",
    waitlist: "Non perderti l'accesso anticipato sulle spiagge! Iscriviti ora.",
};

// Funzione di utilità per un soft "Pop" sonoro sinteticizzato (Web Audio API)
const playNotificationSound = () => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Suono "glassy pop"
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.1);

        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    } catch {
        // Il browser potrebbe bloccare l'audio se non c'è stata prima intenzione/interazione
    }
};

export default function OndaAssistant() {
    const [isVisible, setIsVisible] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    const [currentSection, setCurrentSection] = useState<keyof typeof MESSAGES>('hero');
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const tooltipTimeoutRef = useRef<NodeJS.Timeout>();
    const clearTooltipTimer = useCallback(() => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
            tooltipTimeoutRef.current = undefined;
        }
    }, []);

    const closeTooltip = useCallback((markUnread = true) => {
        clearTooltipTimer();
        setShowTooltip(false);
        setIsTyping(false);
        setHasUnread(markUnread);
    }, [clearTooltipTimer]);

    const openTooltip = useCallback(() => {
        setShowTooltip(true);
        setHasUnread(false);
        setIsTyping(true);
        playNotificationSound();

        // Typing simulation
        setTimeout(() => setIsTyping(false), 1800);

        // Auto dismiss dopo 10 secondi
        clearTooltipTimer();
        tooltipTimeoutRef.current = setTimeout(() => {
            closeTooltip(true); // Se si chiude da solo, lascia il badge "non letto"
        }, 10000);
    }, [clearTooltipTimer, closeTooltip]);

    useEffect(() => {
        const unlockOnHeroComplete = () => {
            if (isVisible) return;

            const heroEl = document.getElementById('hero-sequence');
            if (!heroEl) return;

            const heroBottom = heroEl.offsetTop + heroEl.offsetHeight;
            const viewportBottom = window.scrollY + window.innerHeight;

            // Onda appare solo quando la hero è stata completata almeno una volta.
            if (viewportBottom >= heroBottom - 8) {
                setIsVisible(true);
                setHasUnread(true);
            }
        };

        unlockOnHeroComplete();
        window.addEventListener('scroll', unlockOnHeroComplete, { passive: true });
        window.addEventListener('resize', unlockOnHeroComplete);

        return () => {
            window.removeEventListener('scroll', unlockOnHeroComplete);
            window.removeEventListener('resize', unlockOnHeroComplete);
        };
    }, [isVisible]);

    useEffect(() => {
        return () => clearTooltipTimer();
    }, [clearTooltipTimer]);

    // P1: Smart Scroll Spy per cambiare testo in base alla sezione
    useEffect(() => {
        if (!isVisible) return;
        const handleScroll = () => {
            const scrollY = window.scrollY;
            const vh = window.innerHeight;

            let newSection: keyof typeof MESSAGES = 'hero';
            // Mappatura grezza sulle altezze per dimostrazione (aggiustabile in caso di refactoring layout)
            if (scrollY > vh * 0.7 && scrollY < vh * 2.2) newSection = 'features';
            else if (scrollY >= vh * 2.2 && scrollY < vh * 4) newSection = 'howItWorks';
            else if (scrollY >= vh * 4) newSection = 'waitlist';

            if (newSection !== currentSection) {
                setCurrentSection(newSection);
                // Aggiorna solo lo stato "non letto" senza aprire popup durante lo scroll
                setHasUnread(true);
            }

            // Non bloccare la navigazione: chiudi il popup se l'utente sta scrollando
            if (showTooltip) {
                closeTooltip(true);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [currentSection, showTooltip, closeTooltip, isVisible]);

    const scrollToWaitlist = () => {
        const waitlistEl = document.getElementById('waitlist');
        if (waitlistEl) {
            waitlistEl.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handleTooltipClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        scrollToWaitlist();
        closeTooltip(false);
    };

    const handleAvatarClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showTooltip) {
            closeTooltip(true);
        } else {
            openTooltip();
        }
    };

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        closeTooltip(true);
    };

    // P4: Calcolo movimento magnetico particelle su Hover
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        // Smorziamo la distanza coperta dalle particelle
        setMousePos({
            x: (e.clientX - centerX) * 0.25,
            y: (e.clientY - centerY) * 0.25
        });
    };

    if (!isVisible) return null;

    const currentMessageText = MESSAGES[currentSection];

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 100, scale: 0.5, filter: 'blur(10px)' }}
                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none md:bottom-8 md:right-8"
            >
                {/* Tooltip Premium */}
                <AnimatePresence>
                    {showTooltip && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, x: 20, scale: 0.8, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, x: 0, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="pointer-events-auto relative cursor-pointer group origin-bottom-right"
                            onClick={handleTooltipClick}
                        >
                            {/* Glow del Tooltip */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />

                            <div className="relative bg-[#050510]/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 md:p-5 shadow-2xl max-w-[280px] overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <button
                                    onClick={handleDismiss}
                                    className="absolute top-3 right-3 p-1.5 text-white/30 hover:text-white hover:bg-white/10 rounded-full transition-all opacity-0 group-hover:opacity-100 z-10"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>

                                <div className="flex items-start gap-3 relative z-0">
                                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)] group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-shadow">
                                        <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                                    </div>

                                    <div className="flex-1">
                                        <h4 className="flex items-center gap-1.5 font-medium mb-1.5">
                                            <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent text-sm">Onda AI</span>
                                            <span className="flex h-1.5 w-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                                        </h4>

                                        <div className="text-white/70 text-sm leading-relaxed min-h-[40px]">
                                            {isTyping ? (
                                                <div className="flex gap-1 items-center h-5 mt-1">
                                                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                    <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></span>
                                                </div>
                                            ) : (
                                                <motion.p
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="font-light"
                                                >
                                                    {currentMessageText} <br className="hidden md:block" />
                                                    <span className="text-white/90 font-medium inline-flex items-center gap-1 mt-1 group-hover:text-cyan-300 transition-colors">
                                                        Iscriviti <ChevronRight className="w-3.5 h-3.5" />
                                                    </span>
                                                </motion.p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Avatar Premium Organico con interazione Particellare (P4) */}
                <motion.div
                    className="pointer-events-auto relative w-24 h-24 md:w-28 md:h-28 cursor-pointer group flex items-center justify-center"
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => {
                        setIsHovered(false);
                        setMousePos({ x: 0, y: 0 }); // reset mouse pos
                    }}
                    onMouseMove={handleMouseMove}
                    onClick={handleAvatarClick}
                    whileHover={{ scale: 1.05, rotate: [0, -3, 3, 0] }}
                    whileTap={{ scale: 0.95 }}
                    animate={{
                        y: [0, -12, 0],
                    }}
                    transition={{
                        y: { repeat: Infinity, duration: 4, ease: 'easeInOut' },
                        rotate: { duration: 0.5 }
                    }}
                >
                    {/* P3: Badge Notifica */}
                    <AnimatePresence>
                        {!showTooltip && hasUnread && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-[#000006] shadow-[0_0_10px_rgba(239,68,68,0.6)] z-30"
                            >
                                <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75"></span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Auras organiche */}
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-[30px] group-hover:bg-cyan-400/40 transition-colors duration-700 animate-pulse scale-110"></div>
                    <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-[40px] group-hover:bg-blue-500/40 transition-colors duration-700 scale-150 [animation-delay:1s] animate-pulse"></div>
                    <div className="absolute inset-4 bg-white/10 rounded-full blur-xl group-hover:bg-white/20 transition-colors duration-500 scale-100"></div>

                    <div className="relative w-full h-full drop-shadow-[0_0_25px_rgba(6,182,212,0.4)] group-hover:drop-shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all duration-500 z-10">
                        <Image
                            src={`/images/onda/onda-transparent.png`}
                            alt="Onda AI"
                            fill
                            className="object-contain transform transition-transform duration-500 group-hover:scale-110"
                            sizes="(max-width: 768px) 96px, 112px"
                            priority
                        />
                    </div>

                    {/* P4: Scintille Magnetiche su Hover */}
                    <AnimatePresence>
                        {isHovered && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        x: -30 + mousePos.x, // Movimento magnetico
                                        y: -30 + mousePos.y,
                                        rotate: 360
                                    }}
                                    exit={{ opacity: 0, scale: 0 }}
                                    transition={{
                                        rotate: { repeat: Infinity, duration: 10, ease: "linear" },
                                        x: { type: "spring", stiffness: 100, damping: 20 },
                                        y: { type: "spring", stiffness: 100, damping: 20 }
                                    }}
                                    className="absolute top-0 left-0 text-cyan-300 z-20 pointer-events-none"
                                >
                                    <Sparkles className="w-5 h-5" />
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        x: 30 + mousePos.x * 1.5, // Parallasse più ampio per l'altra particella
                                        y: 30 + mousePos.y * 1.5,
                                        rotate: -360
                                    }}
                                    exit={{ opacity: 0, scale: 0 }}
                                    transition={{
                                        rotate: { repeat: Infinity, duration: 12, ease: "linear" },
                                        x: { type: "spring", stiffness: 80, damping: 25 },
                                        y: { type: "spring", stiffness: 80, damping: 25 }
                                    }}
                                    className="absolute bottom-4 right-0 text-blue-300 z-20 pointer-events-none"
                                >
                                    <Sparkles className="w-4 h-4" />
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
