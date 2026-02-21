'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';
import Image from 'next/image';

function WhatsAppIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
    );
}

function TelegramIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
    );
}

export default function WaitlistForm() {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [copied, setCopied] = useState(false);
    const [mounted, setMounted] = useState(false);
    const inviteCodeRef = useRef('');
    const [inviteCode, setInviteCode] = useState('');

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        setMounted(true);
        // Generate a random mock invite code on mount for later use
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        inviteCodeRef.current = code;
        setInviteCode(code);
    }, []);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Form submission logic
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        if (!email) return;

        setStatus('loading');

        try {
            const response = await fetch('/api/waitlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email,
                    lang: 'it',
                    project: 'where2beach',
                    version: 'waitlist_v2_hero'
                })
            });

            if (response.ok) {
                handleSuccess();
            } else {
                const body = await response.json().catch(() => null);
                if (response.status === 409 || body?.already) {
                    setStatus('idle');
                    setErrorMessage('Questa email è già registrata in lista d\'attesa!');
                } else {
                    setStatus('idle');
                    setErrorMessage(body?.error || 'Errore di connessione. Riprova più tardi.');
                }
            }
        } catch {
            setStatus('idle');
            setErrorMessage('Impossibile connettersi. Riprova più tardi.');
        }
    };

    const handleSuccess = () => {
        setStatus('success');
        setEmail('');
        triggerConfetti();
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 50 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: ReturnType<typeof setInterval> = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    };



    const handleCopyFeedBack = () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getShareLinks = () => {
        const url = `${window.location.origin}/invite/${inviteCode}`;
        const text = encodeURIComponent(`Evita la folla al mare. Sblocca il tuo badge Founding Member esclusivo! Clicca questo link per scalare la classifica: ${url}`);
        return {
            whatsapp: `https://wa.me/?text=${text}`,
            telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`
        };
    };

    return (
        <section id="waitlist" className="w-full bg-[#000006] py-32 px-6 relative overflow-hidden">
            {/* Animated Background Orbs */}
            <motion.div
                animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none"
            />
            <motion.div
                animate={{ x: [0, -20, 0], y: [0, 30, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none"
            />

            <div className="max-w-3xl mx-auto relative z-10 text-center">
                {/* Animated gradient border wrapper */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative rounded-3xl p-[1px] overflow-hidden"
                >
                    {/* Rotating gradient border */}
                    <div className="absolute inset-0 rounded-3xl" style={{
                        background: 'conic-gradient(from 0deg, rgba(6,182,212,0.3), rgba(99,102,241,0.2), rgba(6,182,212,0.05), rgba(59,130,246,0.2), rgba(6,182,212,0.3))',
                        animation: 'spin 6s linear infinite',
                    }} />
                    <div className="relative bg-[#000006]/90 backdrop-blur-xl rounded-3xl p-10 md:p-16 shadow-2xl">
                        {status === 'success' ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center space-y-6"
                            >
                                {/* The Visual Badge Collectible */}
                                <motion.div
                                    initial={{ scale: 0, rotateY: 180 }}
                                    animate={{ scale: 1, rotateY: 0 }}
                                    transition={{ type: "spring", stiffness: 150, damping: 15, delay: 0.1 }}
                                    className="relative flex flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent border border-cyan-500/30 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.2)] mb-4 overflow-hidden group"
                                >
                                    <div className="relative w-24 h-24 rounded-full flex items-center justify-center mb-3 shadow-[0_0_40px_rgba(6,182,212,0.8)] border-2 border-cyan-400/50 overflow-hidden">
                                        <Image src="/badge-new.png" alt="Founding Member Badge" fill className="object-cover" />
                                    </div>

                                    <div className="text-center relative z-10">
                                        <div className="uppercase tracking-widest text-[10px] sm:text-xs font-bold text-cyan-400 mb-1">
                                            Accesso Esclusivo Sbloccato
                                        </div>
                                        <div className="text-xl sm:text-2xl font-black text-white px-4 py-1 bg-white/5 rounded-lg border border-white/10 backdrop-blur-sm">
                                            Founding Member Badge
                                        </div>
                                    </div>
                                </motion.div>

                                <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/80 mt-2">
                                    Sei nella Founding Wave!
                                </h3>

                                <p className="text-white/70 text-lg md:text-xl max-w-lg mx-auto font-medium mt-4">
                                    Il tuo posto esclusivo è confermato. <strong className="text-white">Invita 3 amici</strong> per scalare la classifica e aiutarci ad aprire prima la tua zona.
                                </p>

                                <div className="pt-6 w-full max-w-md mx-auto space-y-4">

                                    {/* Unique Link Input */}
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-md opacity-50 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative flex items-center bg-[#000006] border border-blue-500/30 rounded-xl overflow-hidden p-1 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]">
                                            <div className="flex-1 px-4 py-3 text-left font-mono text-sm sm:text-base text-blue-200 truncate select-all">
                                                {mounted ? `${window.location.host}/invite/${inviteCode}` : 'where2beach.it/invite/...'}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(mounted ? `${window.location.host}/invite/${inviteCode}` : '');
                                                    handleCopyFeedBack();
                                                }}
                                                className="flex-shrink-0 flex items-center justify-center bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 p-3 rounded-lg transition-colors border border-blue-500/20"
                                                title="Copia link"
                                            >
                                                {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Direct Share Buttons */}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <a
                                            href={mounted ? getShareLinks().whatsapp : '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 py-3 rounded-xl font-bold transition-colors"
                                        >
                                            <WhatsAppIcon className="w-5 h-5" />
                                            WhatsApp
                                        </a>
                                        <a
                                            href={mounted ? getShareLinks().telegram : '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 bg-[#0088cc]/10 hover:bg-[#0088cc]/20 text-[#0088cc] border border-[#0088cc]/20 py-3 rounded-xl font-bold transition-colors"
                                        >
                                            <TelegramIcon className="w-5 h-5" />
                                            Telegram
                                        </a>
                                    </div>

                                    <p className="text-white/40 text-sm mt-4 text-center font-medium">
                                        I Founding Member attivi ottengono il badge esclusivo nell&apos;app. 🌊
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                <h3 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                                    IL RADAR PER LE TUE SPIAGGE.
                                </h3>
                                <p className="text-white/60 text-lg mb-8 max-w-lg mx-auto font-medium">
                                    Evita la folla. Scopri dove c&apos;è posto grazie alle segnalazioni della community, in tempo reale. Iscriviti per <strong className="text-white">Accesso anticipato</strong> e badge <strong className="text-white">Founding Member</strong>.
                                </p>
                                <motion.div
                                    animate={{ y: [0, -4, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                    className="inline-flex items-center gap-2 px-4 py-2 mb-10 rounded-xl bg-white/5 border border-cyan-500/20 text-sm text-white/80 font-semibold tracking-tight shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                                >
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></span>
                                    </span>
                                    Prima ondata limitata. I Founding Member entrano per primi.
                                </motion.div>

                                <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl mx-auto">

                                    {errorMessage && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-lg text-sm font-medium text-left mb-2"
                                        >
                                            {errorMessage}
                                        </motion.div>
                                    )}

                                    <div className="flex flex-col md:flex-row gap-4 w-full">
                                        <div className="relative flex-1 group">
                                            <div className="absolute inset-0 bg-white/10 rounded-xl blur-md transition-opacity opacity-0 group-focus-within:opacity-100" />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    if (errorMessage) setErrorMessage('');
                                                }}
                                                placeholder="La tua email..."
                                                className="w-full bg-[#000006]/50 border border-white/20 rounded-xl px-6 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 focus:ring-1 focus:ring-white/50 transition-all font-medium relative z-10"
                                                disabled={status === 'loading'}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={status === 'loading'}
                                            className="group relative flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold tracking-tight hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:hover:scale-100 text-white overflow-hidden"
                                            style={{
                                                background: 'linear-gradient(135deg, #06b6d4, #3b82f6, #6366f1)',
                                                backgroundSize: '200% 200%',
                                                animation: 'gradient-shift 3s ease infinite',
                                            }}
                                        >
                                            {/* Shimmer sweep */}
                                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                                style={{ background: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease-in-out infinite' }} />
                                            {status === 'loading' ? (
                                                <span className="animate-pulse relative z-10">Invio in corso...</span>
                                            ) : (
                                                <>
                                                    <span className="relative z-10">Unisciti ora</span>
                                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                                <p className="text-white/30 text-sm mt-6 font-medium">
                                    Niente spam. Cancellati quando vuoi.
                                </p>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
