import { SiteNav } from "@/components/nav/SiteNav";
import { Hero } from "@/components/hero/Hero";
import { BuiltOn } from "@/components/sections/BuiltOn";
import { ProblemStack } from "@/components/sections/ProblemStack";
import { ParticleStatement } from "@/components/sections/ParticleStatement";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { SettlementGate } from "@/components/sections/SettlementGate";
import { LiveNetwork } from "@/components/sections/LiveNetwork";
import { RailsMarquee } from "@/components/sections/RailsMarquee";
import { Comparison } from "@/components/sections/Comparison";
import { Limitations } from "@/components/sections/Limitations";
import { FinalCta } from "@/components/sections/FinalCta";
import { Footer } from "@/components/footer/Footer";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        <Hero />
        <BuiltOn />
        <ProblemStack />
        <ParticleStatement />
        <HowItWorks />
        <SettlementGate />
        <LiveNetwork />
        <RailsMarquee />
        <Comparison />
        <Limitations />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
