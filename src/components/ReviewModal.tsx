import { memo, useEffect, useRef, useState } from "react";
import { STRINGS } from "../i18n/it";

type ReviewModalProps = {
    isOpen: boolean;
    beachName: string | null;
    authorName: string | null;
    onClose: () => void;
    onSubmit: (content: string, rating: number) => Promise<void>;
};

const ReviewModalComponent = ({
    isOpen,
    beachName,
    authorName,
    onClose,
    onSubmit,
}: ReviewModalProps) => {
    const [content, setContent] = useState("");
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setContent("");
            setRating(0);
            setHoverRating(0);
            setError(null);
            setSubmitting(false);
            // Timeout to allow modal to render before focusing
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content.trim() || submitting || rating === 0) return;

        setSubmitting(true);
        setError(null);
        try {
            await onSubmit(content.trim(), rating);
            onClose();
        } catch (err) {
            setError(STRINGS.report.submitFailed || "Errore durante l'invio");
        } finally {
            if (isOpen) {
                setSubmitting(false);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Scrivi una recensione"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm overflow-hidden rounded-[20px] bg-slate-900 border border-slate-700/60 shadow-2xl contrast-guard"
            >
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
                    <h2 className="text-base font-semibold text-slate-100 flex-1">
                        {beachName ? `Recensisci ${beachName}` : "Nuova recensione"}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10 transition"
                        aria-label={STRINGS.actions.close}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
                    <div className="flex flex-col items-center gap-2 mb-2">
                        <div className="text-sm font-medium text-slate-300">Valutazione</div>
                        <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    className="p-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-500 rounded-full transition-transform hover:scale-110"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    aria-label={`${star} stelle su 5`}
                                >
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill={star <= (hoverRating || rating) ? "currentColor" : "none"}
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className={`h-7 w-7 transition-colors ${star <= (hoverRating || rating) ? "text-amber-400" : "text-slate-600"
                                            }`}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                            La tua recensione come {authorName || "Utente"}
                        </label>
                        <textarea
                            ref={inputRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Racconta la tua esperienza..."
                            className="w-full h-32 resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
                            maxLength={1000}
                        />
                        <div className="text-right text-[10px] text-slate-500 mt-1">
                            {content.length}/1000
                        </div>
                    </div>

                    {error && (
                        <div className="text-xs text-rose-400 bg-rose-400/10 px-3 py-2 rounded-lg border border-rose-400/20">
                            {error}
                        </div>
                    )}

                    <div className="mt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 rounded-xl bg-slate-800 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !content.trim() || rating === 0}
                            className="flex-1 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-400 disabled:bg-sky-600/50 disabled:text-white/60"
                        >
                            {submitting ? "Invio..." : "Avanti"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default memo(ReviewModalComponent);
