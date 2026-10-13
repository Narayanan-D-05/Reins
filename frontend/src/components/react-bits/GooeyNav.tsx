"use client";

/// Ported from reactbits.dev (GooeyNav-JS-CSS) and converted to
/// TypeScript, with the particle palette mapped to our single accent
/// color (see Section 4.2 color-consistency lock) instead of the
/// original multi-hue set.
import { useRef, useEffect, useState, type MouseEvent, type KeyboardEvent } from "react";
import "./GooeyNav.css";

export interface GooeyNavItem {
  label: string;
  href: string;
}

export interface GooeyNavProps {
  items: GooeyNavItem[];
  animationTime?: number;
  particleCount?: number;
  particleDistances?: [number, number];
  particleR?: number;
  timeVariance?: number;
  colors?: number[];
  initialActiveIndex?: number;
}

// Impure (Math.random-based) by design — a burst of particles should
// look different every time. Kept at module scope, not inside the
// component body, since they're only ever invoked from the click handler
// (never during render) and React's purity rule flags any impure helper
// defined inside a component function regardless of where it's called.
const noise = (n = 1) => n / 2 - Math.random() * n;

const getXY = (distance: number, pointIndex: number, totalPoints: number): [number, number] => {
  const angle = ((360 + noise(8)) / totalPoints) * pointIndex * (Math.PI / 180);
  return [distance * Math.cos(angle), distance * Math.sin(angle)];
};

const createParticle = (
  i: number,
  t: number,
  d: [number, number],
  r: number,
  particleCount: number,
  colors: number[]
) => {
  const rotate = noise(r / 10);
  return {
    start: getXY(d[0], particleCount - i, particleCount),
    end: getXY(d[1] + noise(7), particleCount - i, particleCount),
    time: t,
    scale: 1 + noise(0.2),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotate: rotate > 0 ? (rotate + r / 20) * 10 : (rotate - r / 20) * 10,
  };
};

export default function GooeyNav({
  items,
  animationTime = 600,
  particleCount = 12,
  particleDistances = [70, 10],
  particleR = 80,
  timeVariance = 300,
  colors = [1, 2, 3, 1, 2, 3, 1, 4],
  initialActiveIndex = 0,
}: GooeyNavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const filterRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);

  const makeParticles = (element: HTMLElement) => {
    const d = particleDistances;
    const r = particleR;
    const bubbleTime = animationTime * 2 + timeVariance;
    element.style.setProperty("--time", `${bubbleTime}ms`);

    for (let i = 0; i < particleCount; i++) {
      const t = animationTime * 2 + noise(timeVariance * 2);
      const p = createParticle(i, t, d, r, particleCount, colors);
      element.classList.remove("active");

      setTimeout(() => {
        const particle = document.createElement("span");
        const point = document.createElement("span");
        particle.classList.add("gooey-particle");
        particle.style.setProperty("--start-x", `${p.start[0]}px`);
        particle.style.setProperty("--start-y", `${p.start[1]}px`);
        particle.style.setProperty("--end-x", `${p.end[0]}px`);
        particle.style.setProperty("--end-y", `${p.end[1]}px`);
        particle.style.setProperty("--time", `${p.time}ms`);
        particle.style.setProperty("--scale", `${p.scale}`);
        particle.style.setProperty("--color", `var(--gooey-color-${p.color}, var(--accent))`);
        particle.style.setProperty("--rotate", `${p.rotate}deg`);

        point.classList.add("gooey-point");
        particle.appendChild(point);
        element.appendChild(particle);
        requestAnimationFrame(() => element.classList.add("active"));
        setTimeout(() => {
          try {
            element.removeChild(particle);
          } catch {
            // already removed
          }
        }, t);
      }, 30);
    }
  };

  const updateEffectPosition = (element: HTMLElement) => {
    if (!containerRef.current || !filterRef.current || !textRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const pos = element.getBoundingClientRect();

    const styles = {
      left: `${pos.x - containerRect.x}px`,
      top: `${pos.y - containerRect.y}px`,
      width: `${pos.width}px`,
      height: `${pos.height}px`,
    };
    Object.assign(filterRef.current.style, styles);
    Object.assign(textRef.current.style, styles);
    textRef.current.innerText = element.innerText;
  };

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
    const liEl = e.currentTarget.parentElement as HTMLElement;
    if (activeIndex === index) return;

    setActiveIndex(index);
    updateEffectPosition(liEl);

    if (filterRef.current) {
      const particles = filterRef.current.querySelectorAll(".gooey-particle");
      particles.forEach((p) => filterRef.current!.removeChild(p));
    }

    if (textRef.current) {
      textRef.current.classList.remove("active");
      void textRef.current.offsetWidth;
      textRef.current.classList.add("active");
    }

    if (filterRef.current) makeParticles(filterRef.current);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const liEl = e.currentTarget.parentElement;
      if (liEl) handleClick({ currentTarget: e.currentTarget } as MouseEvent<HTMLAnchorElement>, index);
    }
  };

  useEffect(() => {
    if (!navRef.current || !containerRef.current) return;
    const activeLi = navRef.current.querySelectorAll("li")[activeIndex];
    if (activeLi) {
      updateEffectPosition(activeLi);
      textRef.current?.classList.add("active");
    }

    const resizeObserver = new ResizeObserver(() => {
      const currentActiveLi = navRef.current?.querySelectorAll("li")[activeIndex];
      if (currentActiveLi) updateEffectPosition(currentActiveLi);
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [activeIndex]);

  return (
    <div className="gooey-nav-container" ref={containerRef}>
      <nav>
        <ul ref={navRef}>
          {items.map((item, index) => (
            <li key={item.label} className={activeIndex === index ? "active" : ""}>
              <a
                href={item.href}
                onClick={(e) => handleClick(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <span className="effect filter" ref={filterRef} />
      <span className="effect text" ref={textRef} />
    </div>
  );
}
