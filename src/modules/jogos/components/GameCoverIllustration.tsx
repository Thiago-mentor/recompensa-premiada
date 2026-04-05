"use client";

import { useId } from "react";
import type { GameCatalogEntry } from "../core/gameRegistry";

type GameCoverId = GameCatalogEntry["id"];

/**
 * Capas desenhadas em SVG inline (sem arquivos externos) — gradientes e filtros por instância (useId).
 */
export function GameCoverIllustration({ gameId }: { gameId: GameCoverId }) {
  const raw = useId().replace(/:/g, "");
  switch (gameId) {
    case "ppt":
      return <CoverPpt uid={raw} />;
    case "quiz":
      return <CoverQuiz uid={raw} />;
    case "reaction_tap":
      return <CoverReaction uid={raw} />;
    case "roleta":
      return <CoverRoleta uid={raw} />;
    case "bau":
      return <CoverBau uid={raw} />;
    default:
      return <CoverFallback uid={raw} />;
  }
}

function CoverPpt({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("bg")} cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#5b21b6" />
          <stop offset="45%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={g("card1")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>
        <linearGradient id={g("card2")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#a21caf" />
        </linearGradient>
        <linearGradient id={g("card3")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id={g("glow")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <g opacity="0.12" fill="none" stroke="#fff" strokeWidth="0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={i} x1={i * 72} y1="0" x2={i * 72 + 180} y2="360" />
        ))}
      </g>
      <g filter={`url(#${g("glow")})`} transform="translate(320 175)">
        <g transform="rotate(-14) translate(-130 0)">
          <rect x="-55" y="-75" width="110" height="150" rx="14" fill={`url(#${g("card1")})`} opacity="0.95" />
          <circle cx="0" cy="-15" r="28" fill="#0f172a" opacity="0.35" />
          <path d="M-22 25h44" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
        </g>
        <g transform="rotate(0)">
          <rect x="-58" y="-78" width="116" height="156" rx="16" fill={`url(#${g("card2")})`} opacity="0.98" />
          <rect x="-40" y="-50" width="80" height="100" rx="6" fill="#faf5ff" opacity="0.2" />
          <path d="M-35-30h70M-35-8h55M-35 14h62" stroke="#faf5ff" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        </g>
        <g transform="rotate(14) translate(130 0)">
          <rect x="-55" y="-75" width="110" height="150" rx="14" fill={`url(#${g("card3")})`} opacity="0.95" />
          <path d="M-25-35 L25 35M25-35 L-25 35" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" />
          <circle cx="0" cy="-38" r="20" fill="#fef3c7" opacity="0.9" />
        </g>
      </g>
      <text x="320" y="52" textAnchor="middle" fill="#f8fafc" fontSize="26" fontWeight="800" fontFamily="system-ui,sans-serif" letterSpacing="0.2em">
        PPT
      </text>
    </svg>
  );
}

function CoverQuiz({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("spot")} cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.9" />
          <stop offset="70%" stopColor="#1e1b4b" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={g("gold")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="#020617" />
      <rect width="640" height="360" fill={`url(#${g("spot")})`} />
      <circle cx="320" cy="165" r="72" fill="#0f172a" stroke={`url(#${g("gold")})`} strokeWidth="5" />
      <text x="320" y="188" textAnchor="middle" fill="#fef3c7" fontSize="72" fontWeight="900" fontFamily="system-ui,sans-serif">
        ?
      </text>
      <g opacity="0.9">
        <rect x="88" y="268" width="112" height="36" rx="10" fill="#10b981" opacity="0.85" />
        <rect x="220" y="268" width="112" height="36" rx="10" fill="#6366f1" opacity="0.75" />
        <rect x="352" y="268" width="112" height="36" rx="10" fill="#ec4899" opacity="0.75" />
        <rect x="484" y="268" width="68" height="36" rx="10" fill="#64748b" opacity="0.6" />
      </g>
      <text x="320" y="48" textAnchor="middle" fill="#e9d5ff" fontSize="22" fontWeight="800" fontFamily="system-ui,sans-serif" letterSpacing="0.15em">
        QUIZ
      </text>
    </svg>
  );
}

function CoverReaction({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("bg")} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#064e3b" />
          <stop offset="100%" stopColor="#022c22" />
        </radialGradient>
        <radialGradient id={g("core")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="70%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <circle cx="320" cy="185" r="142" fill="none" stroke="#22c55e" strokeWidth="2" opacity="0.25" />
      <circle cx="320" cy="185" r="118" fill="none" stroke="#fbbf24" strokeWidth="2" opacity="0.35" strokeDasharray="8 12" />
      <circle cx="320" cy="185" r="88" fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.5" />
      <circle cx="320" cy="185" r="52" fill={`url(#${g("core")})`} stroke="#bbf7d0" strokeWidth="3" />
      <circle cx="320" cy="185" r="16" fill="#f0fdf4" />
      <path d="M480 95 L540 125 M505 70 L545 115" stroke="#facc15" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <text x="320" y="48" textAnchor="middle" fill="#d1fae5" fontSize="20" fontWeight="800" fontFamily="system-ui,sans-serif" letterSpacing="0.25em">
        REACTION
      </text>
    </svg>
  );
}

function CoverRoleta({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  const cx = 320;
  const cy = 200;
  const r = 130;
  const segs = [
    "#b45309",
    "#ca8a04",
    "#eab308",
    "#facc15",
    "#d97706",
    "#92400e",
    "#f59e0b",
    "#78350f",
  ];
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("felt")} cx="50%" cy="100%" r="90%">
          <stop offset="0%" stopColor="#292524" />
          <stop offset="100%" stopColor="#0c0a09" />
        </radialGradient>
        <linearGradient id={g("rim")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("felt")})`} />
      <g transform={`translate(${cx} ${cy})`}>
        {segs.map((fill, i) => {
          const a0 = (i * 360) / segs.length - 90;
          const a1 = ((i + 1) * 360) / segs.length - 90;
          const rad0 = (a0 * Math.PI) / 180;
          const rad1 = (a1 * Math.PI) / 180;
          const x0 = r * Math.cos(rad0);
          const y0 = r * Math.sin(rad0);
          const x1 = r * Math.cos(rad1);
          const y1 = r * Math.sin(rad1);
          const large = a1 - a0 > 180 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M 0 0 L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
              fill={fill}
              stroke="#1c1917"
              strokeWidth="2"
              opacity="0.95"
            />
          );
        })}
        <circle r="36" fill="#1c1917" stroke={`url(#${g("rim")})`} strokeWidth="4" />
        <circle r="14" fill="#fef08a" />
      </g>
      <path d="M320 42 L338 78 H302 Z" fill="#fef08a" stroke="#b45309" strokeWidth="2" />
      <text x="320" y="32" textAnchor="middle" fill="#fef3c7" fontSize="22" fontWeight="800" fontFamily="system-ui,sans-serif" letterSpacing="0.12em">
        ROLETA
      </text>
    </svg>
  );
}

function CoverBau({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={g("bg")} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <linearGradient id={g("wood")} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#92400e" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id={g("gold")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <radialGradient id={g("shine")} cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <ellipse cx="320" cy="310" rx="200" ry="28" fill="#000" opacity="0.35" />
      <path d="M200 195 L320 135 L440 195 V275 H200 Z" fill={`url(#${g("wood")})`} stroke="#78350f" strokeWidth="3" />
      <path d="M195 195 H445 L320 120 Z" fill="#a16207" stroke={`url(#${g("gold")})`} strokeWidth="3" />
      <rect x="230" y="205" width="180" height="95" rx="8" fill="#78350f" stroke="#451a03" strokeWidth="2" />
      <rect x="288" y="235" width="64" height="52" rx="6" fill="#0f172a" stroke={`url(#${g("gold")})`} strokeWidth="3" />
      <circle cx="320" cy="258" r="14" fill={`url(#${g("gold")})`} />
      <ellipse cx="320" cy="125" rx="160" ry="40" fill={`url(#${g("shine")})`} />
      <text x="320" y="52" textAnchor="middle" fill="#fef9c3" fontSize="22" fontWeight="800" fontFamily="system-ui,sans-serif" letterSpacing="0.08em">
        BAU
      </text>
    </svg>
  );
}

function CoverFallback({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={g("bg")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
    </svg>
  );
}
