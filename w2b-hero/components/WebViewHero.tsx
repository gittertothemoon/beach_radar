import Image from 'next/image';

export default function WebViewHero() {
  return (
    <section className="wv-only-inapp w-full bg-[#000006] px-6 pt-16 pb-12">
      <div className="mx-auto max-w-xl rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <Image
          src="/logo.png"
          alt="Where2Beach"
          width={120}
          height={120}
          className="mx-auto mb-6 h-24 w-24 object-contain"
          priority
        />
        <h2 className="text-3xl font-black tracking-tight text-white">
          La spiaggia giusta, prima di partire.
        </h2>
        <p className="mt-4 text-base font-medium leading-relaxed text-white/70">
          Controlla affollamento, vento, onde e meteo in tempo reale.
        </p>
        <a
          href="/app/"
          className="mt-8 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-3 text-base font-bold text-white shadow-[0_10px_30px_rgba(14,165,233,0.35)]"
        >
          Apri l&apos;app
        </a>
      </div>
    </section>
  );
}
