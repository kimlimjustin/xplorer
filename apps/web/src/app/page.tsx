import { Hero } from '@/components/landing/Hero';
import { TechStrip } from '@/components/landing/TechStrip';
import { FeatureShowcase } from '@/components/landing/FeatureShowcase';
import { Stats } from '@/components/landing/Stats';
import { Cta } from '@/components/landing/Cta';

export default function HomePage() {
  return (
    <>
      <Hero />
      <TechStrip />
      <FeatureShowcase />
      <Stats />
      <Cta />
    </>
  );
}
