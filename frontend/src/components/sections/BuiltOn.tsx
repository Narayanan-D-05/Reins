const STACK = [
  { name: "Monad", note: "P256 precompile" },
  { name: "Mera", note: "Passkey key derivation" },
  { name: "Envio", note: "HyperIndex" },
];

export function BuiltOn() {
  return (
    <section className="border-y border-border py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STACK.map((item) => (
            <div key={item.name} className="flex items-baseline justify-center gap-3 sm:justify-start">
              <span className="font-mono text-base tracking-wide text-text">{item.name}</span>
              <span className="text-sm text-text-faint">{item.note}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
