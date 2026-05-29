"use client";
import { useEffect, useState } from "react";

export default function FloatingDots() {
  const [dots, setDots] = useState<{ id: number; left: string; size: string; duration: string; delay: string; opacity: number }[]>([]);

  useEffect(() => {
    const newDots = Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: `${Math.random() * 3 + 2}px`,
      duration: `${Math.random() * 12 + 14}s`,
      delay: `${Math.random() * -20}s`,
      opacity: Math.random() * 0.25 + 0.08,
    }));
    setDots(newDots);
  }, []);

  return (
    <div className="fixed inset-0 h-screen w-screen overflow-hidden pointer-events-none z-[1]">
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="particle"
          style={{
            left: dot.left,
            width: dot.size,
            height: dot.size,
            animationDuration: dot.duration,
            animationDelay: dot.delay,
            backgroundColor: `var(--accent-primary)`,
            opacity: dot.opacity,
            filter: `blur(1px)`,
          }}
        />
      ))}
    </div>
  );
}