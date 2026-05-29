'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FiLock, FiUsers, FiZap, FiArrowRight } from 'react-icons/fi';
import Logo from '@/components/Logo';
import GradientText from '@/components/GradientText';

gsap.registerPlugin(ScrollTrigger);

/* ── Stagger animation container ───────────────────────────────────────────── */
function StaggerReveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12 } },
      }}
    >
      {children}
    </motion.div>
  );
}

function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 28 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Feature data ──────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: FiLock,
    title: 'Secure & Private',
    desc: 'Password-protected rooms ensure only invited participants can join your conversations.',
    spotlight: false,
  },
  {
    icon: FiUsers,
    title: 'Fully Anonymous',
    desc: "No one knows who's speaking. Perfect for honest, judgment-free discussions.",
    spotlight: true,
  },
  {
    icon: FiZap,
    title: 'Real-time Messaging',
    desc: 'Messages appear instantly for everyone in the room. No delays, no refresh.',
    spotlight: false,
  },
];

const STEPS = [
  { step: '01', title: 'Create a room', desc: 'Sign up, pick a name and password for your room, and choose how long it should last.' },
  { step: '02', title: 'Share the link', desc: 'Copy the room link and send it to whoever you want to chat with — no account needed to join.' },
  { step: '03', title: 'Chat anonymously', desc: 'Everyone in the room is anonymous. React to messages, reply in threads, and chat freely.' },
];

/* ── Landing Page ──────────────────────────────────────────────────────────── */
export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const orbRef1 = useRef<HTMLDivElement>(null);
  const orbRef2 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ambient orb motion via GSAP
    if (orbRef1.current) {
      gsap.to(orbRef1.current, {
        x: 40,
        y: -30,
        duration: 8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }
    if (orbRef2.current) {
      gsap.to(orbRef2.current, {
        x: -35,
        y: 25,
        duration: 10,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });
    }

    // ScrollTrigger for section entrances
    const sections = document.querySelectorAll('[data-scroll-reveal]');
    sections.forEach((section) => {
      gsap.from(section, {
        scrollTrigger: {
          trigger: section,
          start: 'top 85%',
          once: true,
        },
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/70 backdrop-blur-2xl border-b border-[var(--border-secondary)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex justify-between items-center h-16">
            <Logo size="sm" />
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-5 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-full hover:bg-[var(--surface-1)]"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 text-sm bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full font-medium hover:opacity-90 transition-opacity"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-16">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section ref={heroRef} className="relative overflow-hidden">
          {/* Ambient gradient orbs */}
          <div
            ref={orbRef1}
            className="absolute top-[-10%] right-[10%] w-[500px] h-[500px] rounded-full opacity-[0.07]"
            style={{ background: 'radial-gradient(circle, var(--accent-primary), transparent 70%)' }}
          />
          <div
            ref={orbRef2}
            className="absolute bottom-[-20%] left-[5%] w-[600px] h-[600px] rounded-full opacity-[0.05]"
            style={{ background: 'radial-gradient(circle, var(--gradient-coral), transparent 70%)' }}
          />

          <div className="relative max-w-5xl mx-auto px-5 sm:px-8 pt-20 sm:pt-32 pb-16 sm:pb-24">
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Eyebrow */}
              <motion.div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--surface-1)] border border-[var(--border-primary)] text-xs text-[var(--text-secondary)] font-medium tracking-wide mb-8"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                Private by design
              </motion.div>

              {/* Headline */}
              <motion.h1
                className="display-hero text-5xl sm:text-6xl md:text-8xl mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                Anonymous Chat
                <br />
                <GradientText animated className="display-hero">
                  Made Simple
                </GradientText>
              </motion.h1>

              {/* Subhead */}
              <motion.p
                className="text-lg sm:text-xl text-[var(--text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                Create secure, password-protected chat rooms in seconds.
                Share the link. Chat anonymously with anyone.
              </motion.p>

              {/* CTAs */}
              <motion.div
                className="flex flex-col sm:flex-row gap-3 justify-center items-center"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <Link
                  href="/register"
                  className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-full font-medium shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-strong)] hover:scale-[1.03] active:scale-[0.97] transition-all duration-200"
                >
                  Create a Room
                  <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-[var(--surface-1)] text-[var(--text-primary)] rounded-full font-medium border border-[var(--border-primary)] hover:border-[var(--border-accent)] hover:bg-[var(--surface-2)] transition-all duration-200"
                >
                  Sign In
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <StaggerReveal className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {FEATURES.map((feature) => (
                <StaggerItem key={feature.title}>
                  {feature.spotlight ? (
                    /* Gradient spotlight card — the signature atmosphere device */
                    <div className="relative p-8 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--gradient-coral)] shadow-[var(--shadow-glow)] overflow-hidden group h-full">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                      <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-5">
                          <feature.icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold mb-3 text-white tracking-[-0.02em]">{feature.title}</h3>
                        <p className="text-white/80 leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                  ) : (
                    /* Surface card */
                    <div className="p-8 rounded-2xl bg-[var(--surface-1)] border border-[var(--border-primary)] hover:border-[var(--border-accent)] transition-all duration-300 group h-full">
                      <div className="w-12 h-12 rounded-xl bg-[var(--accent-glow)] flex items-center justify-center mb-5 group-hover:shadow-[var(--shadow-glow)] transition-shadow duration-300">
                        <feature.icon className="w-6 h-6 text-[var(--accent-primary)]" />
                      </div>
                      <h3 className="text-xl font-semibold mb-3 tracking-[-0.02em]">{feature.title}</h3>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{feature.desc}</p>
                    </div>
                  )}
                </StaggerItem>
              ))}
            </StaggerReveal>
          </div>
        </section>

        {/* ── How It Works ─────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-28" data-scroll-reveal>
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-16">
              <h2 className="display-lg text-3xl sm:text-5xl mb-4">
                How it <GradientText>works</GradientText>
              </h2>
              <p className="text-[var(--text-secondary)] max-w-lg mx-auto text-lg">
                Get a private chat room up and running in under a minute.
              </p>
            </div>

            <StaggerReveal className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              {/* Connector line — desktop only */}
              <div className="hidden md:block absolute top-14 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-[var(--accent-primary)]/20 via-[var(--accent-primary)]/60 to-[var(--accent-primary)]/20" />

              {STEPS.map(({ step, title, desc }) => (
                <StaggerItem key={step} className="relative flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-[var(--shadow-glow)]">
                      <span className="text-2xl font-bold text-white tracking-tighter">{step}</span>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 tracking-[-0.02em]">{title}</h3>
                  <p className="text-[var(--text-secondary)] max-w-[280px] leading-relaxed">{desc}</p>
                </StaggerItem>
              ))}
            </StaggerReveal>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="py-20 sm:py-28" data-scroll-reveal>
          <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
            <h2 className="display-lg text-3xl sm:text-5xl mb-5">
              Ready to <GradientText animated>chat</GradientText>?
            </h2>
            <p className="text-[var(--text-secondary)] text-lg mb-10 max-w-md mx-auto">
              Create your first anonymous room in seconds. No credit card, no tracking, no judgment.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 px-10 py-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white rounded-full font-medium text-lg shadow-[var(--shadow-glow)] hover:shadow-[var(--shadow-glow-strong)] hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 animate-glow"
            >
              Get started for free
              <FiArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-secondary)] py-8">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 text-center text-[var(--text-tertiary)] text-sm">
          <p>© {new Date().getFullYear()} Blur. Anonymous chat made simple.</p>
        </div>
      </footer>

      {/* Schema.org */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Blur',
            url: 'https://blursocial.codiac.online',
            description:
              'Create secure, password-protected chat rooms and share them instantly. Blur offers a private, anonymous, and real-time messaging experience.',
            applicationCategory: 'CommunicationApplication',
            operatingSystem: 'All',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          }),
        }}
      />
    </div>
  );
}
