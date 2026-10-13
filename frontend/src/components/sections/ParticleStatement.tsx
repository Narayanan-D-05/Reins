"use client";

import ParticleText from "@/components/react-bits/ParticleText";

/// A dedicated kinetic-type beat between the problem and the mechanism —
/// motivated as a hinge moment (PRD §5.5: "Pull the reins" is the single
/// action this whole system exists to make trustworthy). Short text only:
/// ParticleText samples and draws in one line, so this is intentionally
/// three words, not a sentence that needs to wrap.
export function ParticleStatement() {
  return (
    <section className="flex h-[48vh] min-h-[320px] items-center justify-center border-y border-border bg-bg">
      <div className="h-full w-full max-w-5xl px-6">
        <ParticleText
          text="PULL THE REINS"
          particleSize={2.4}
          density={3}
          color="#e9f1f3"
          highlightColor="#4fe1c8"
          scatter={160}
          gatherDuration={1400}
          stagger={360}
          pointerRepel={36}
          repelRadius={110}
          idleDrift={0.6}
          trigger="mount"
          fontSize="clamp(2.5rem, 8vw, 6rem)"
          fontWeight={600}
          fontFamily="inherit"
          glow
        />
      </div>
    </section>
  );
}
