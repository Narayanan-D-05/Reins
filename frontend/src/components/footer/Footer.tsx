export function Footer() {
  return (
    <footer className="overflow-hidden border-t border-border">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <span className="font-mono text-sm tracking-[0.1em] text-text">REINS</span>
          <p className="text-sm text-text-faint">
            Built for the Monad Metropolis Hackathon, Track 04: Trust, Identity &amp; AI Infrastructure.
          </p>
        </div>
        <div className="mt-8 flex flex-col gap-2 text-sm text-text-faint md:flex-row md:gap-8">
          <a
            href="https://docs.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-200 ease-out hover:text-text"
          >
            Monad docs
          </a>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-200 ease-out hover:text-text"
          >
            Monad faucet
          </a>
        </div>
      </div>

      <div aria-hidden="true" className="select-none pb-4">
        <span
          className="display-heading block whitespace-nowrap text-center leading-none text-transparent"
          style={{
            fontSize: "min(22vw, 260px)",
            WebkitTextStroke: "1px var(--border-strong)",
          }}
        >
          REINS
        </span>
      </div>
    </footer>
  );
}
