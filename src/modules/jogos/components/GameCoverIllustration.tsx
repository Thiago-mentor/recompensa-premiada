"use client";

import { useId } from "react";
import type { GameCatalogEntry } from "../core/gameRegistry";

type GameCoverId = GameCatalogEntry["id"];

/**
 * Ilustrações vetoriais premium (estilo 3D/cassino): luz, bloom, sombras e gradientes metálicos — sem PNGs.
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
        <radialGradient id={g("bg")} cx="50%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="40%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#030712" />
        </radialGradient>
        <linearGradient id={g("card1")} x1="15%" y1="10%" x2="85%" y2="95%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="45%" stopColor="#0891b2" />
          <stop offset="100%" stopColor="#164e63" />
        </linearGradient>
        <linearGradient id={g("card2")} x1="10%" y1="5%" x2="90%" y2="100%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="40%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#581c87" />
        </linearGradient>
        <linearGradient id={g("card3")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="35%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#a16207" />
        </linearGradient>
        <linearGradient id={g("gloss")} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
        </linearGradient>
        <filter id={g("card3d")} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="b" />
          <feOffset dx="0" dy="6" in="b" result="o" />
          <feFlood floodColor="#000000" floodOpacity="0.45" result="f" />
          <feComposite in="f" in2="o" operator="in" result="sh" />
          <feMerge>
            <feMergeNode in="sh" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={g("neon")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.6  0 1 0 0 0.3  0 0 1 0 1  0 0 0 0.55 0"
            result="glow"
          />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <ellipse cx="320" cy="332" rx="240" ry="44" fill="#000" opacity="0.42" />
      <g opacity="0.12" fill="none" stroke="#c4b5fd" strokeWidth="0.55">
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={i} x1={i * 52 - 20} y1="0" x2={i * 52 + 200} y2="380" />
        ))}
      </g>
      <g filter={`url(#${g("neon")})`} transform="translate(320 188)">
        <g filter={`url(#${g("card3d")})`} transform="rotate(-16) translate(-148 8)">
          <rect x="-58" y="-82" width="116" height="164" rx="18" fill={`url(#${g("card1")})`} stroke="#22d3ee" strokeWidth="2" />
          <rect x="-58" y="-82" width="116" height="84" rx="18" fill={`url(#${g("gloss")})`} />
          <circle cx="0" cy="-18" r="30" fill="#0f172a" opacity="0.45" />
          <path d="M-26 30h52" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" opacity="0.9" />
        </g>
        <g filter={`url(#${g("card3d")})`} transform="translate(0 -4)">
          <rect x="-62" y="-86" width="124" height="172" rx="20" fill={`url(#${g("card2")})`} stroke="#e879f9" strokeWidth="2.5" />
          <rect x="-62" y="-86" width="124" height="88" rx="20" fill={`url(#${g("gloss")})`} />
          <rect x="-44" y="-58" width="88" height="108" rx="8" fill="#faf5ff" opacity="0.14" />
          <path d="M-38-34h76M-38-10h60M-38 14h68" stroke="#faf5ff" strokeWidth="4.5" strokeLinecap="round" opacity="0.88" />
        </g>
        <g filter={`url(#${g("card3d")})`} transform="rotate(16) translate(148 8)">
          <rect x="-58" y="-82" width="116" height="164" rx="18" fill={`url(#${g("card3")})`} stroke="#fcd34d" strokeWidth="2" />
          <rect x="-58" y="-82" width="116" height="84" rx="18" fill={`url(#${g("gloss")})`} />
          <path d="M-28-38 L28 38M28-38 L-28 38" stroke="#422006" strokeWidth="9" strokeLinecap="round" />
          <circle cx="0" cy="-42" r="22" fill="#fef9c3" opacity="0.95" />
        </g>
      </g>
      <circle cx="520" cy="70" r="3" fill="#fde047" opacity="0.85" />
      <circle cx="118" cy="92" r="2.5" fill="#22d3ee" opacity="0.8" />
    </svg>
  );
}

function CoverQuiz({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("bg")} cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="50%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
        <linearGradient id={g("gold")} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="35%" stopColor="#eab308" />
          <stop offset="70%" stopColor="#b45309" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
        <radialGradient id={g("orb")} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="55%" stopColor="#2e1065" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <linearGradient id={g("orbShine")} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={g("qfill")} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="50%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
        <filter id={g("orbGlow")} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="14" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0.9 0 0 0 0.7  0 0.5 0 0 0.2  0 0 1 0 1  0 0 0 0.65 0"
            result="gb"
          />
          <feMerge>
            <feMergeNode in="gb" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={g("disc3d")} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b" />
          <feOffset dx="0" dy="8" in="b" result="o" />
          <feFlood floodOpacity="0.5" result="f" />
          <feComposite in="f" in2="o" operator="in" result="s" />
          <feMerge>
            <feMergeNode in="s" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <ellipse cx="320" cy="298" rx="175" ry="38" fill="#000" opacity="0.38" />
      <g filter={`url(#${g("orbGlow")})`}>
        <circle cx="320" cy="172" r="108" fill="none" stroke={`url(#${g("gold")})`} strokeWidth="3" opacity="0.6" />
        <g filter={`url(#${g("disc3d")})`}>
          <circle cx="320" cy="168" r="86" fill={`url(#${g("orb")})`} stroke={`url(#${g("gold")})`} strokeWidth="5" />
          <circle cx="320" cy="168" r="86" fill={`url(#${g("orbShine")})`} />
          <text
            x="320"
            y="200"
            textAnchor="middle"
            fill={`url(#${g("qfill")})`}
            fontSize="92"
            fontWeight="900"
            fontFamily="system-ui,sans-serif"
            paintOrder="stroke"
            stroke="#451a03"
            strokeWidth="3"
            strokeOpacity="0.35"
          >
            ?
          </text>
        </g>
      </g>
      <g transform="translate(0 258)">
        {[
          { x: 80, w: 118, c: "#059669" },
          { x: 214, w: 118, c: "#4f46e5" },
          { x: 348, w: 118, c: "#db2777" },
          { x: 482, w: 72, c: "#475569" },
        ].map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y="0"
              width={b.w}
              height="40"
              rx="11"
              fill={b.c}
              opacity="0.92"
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="1"
            />
            <rect x={b.x} y="0" width={b.w} height="19" rx="11" fill="#fff" opacity="0.15" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function CoverReaction({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("bg")} cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#065f46" />
          <stop offset="55%" stopColor="#022c22" />
          <stop offset="100%" stopColor="#010f0c" />
        </radialGradient>
        <radialGradient id={g("core")} cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="55%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#14532d" />
        </radialGradient>
        <filter id={g("ringBloom")} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feColorMatrix
            in="b"
            type="matrix"
            values="0 1 0 0 0  0 1 0 0.8 0  0 0.5 1 0 0  0 0 0 0.45 0"
            result="gb"
          />
          <feMerge>
            <feMergeNode in="gb" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={g("coreshine")} cx="35%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <ellipse cx="320" cy="305" rx="200" ry="36" fill="#000" opacity="0.4" />
      <g filter={`url(#${g("ringBloom")})`} transform="translate(320 182)">
        <circle r="152" fill="none" stroke="#34d399" strokeWidth="2" opacity="0.2" />
        <circle r="128" fill="none" stroke="#fbbf24" strokeWidth="2.5" opacity="0.45" strokeDasharray="10 16" />
        <circle r="100" fill="none" stroke="#f87171" strokeWidth="3" opacity="0.55" />
        <circle r="72" fill="none" stroke="#4ade80" strokeWidth="2" opacity="0.35" />
        <circle r="54" fill={`url(#${g("core")})`} stroke="#bbf7d0" strokeWidth="4" />
        <circle r="54" fill={`url(#${g("coreshine")})`} opacity="0.25" />
        <circle r="17" fill="#f0fdf4" stroke="#fef08a" strokeWidth="2" />
      </g>
      <path
        d="M500 88 L558 118 M528 62 L572 104"
        stroke="#fde047"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.92"
        filter={`url(#${g("ringBloom")})`}
      />
    </svg>
  );
}

function CoverRoleta({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  const cx = 320;
  const cy = 198;
  const r = 128;
  const segs = ["#b45309", "#ca8a04", "#eab308", "#facc15", "#d97706", "#92400e", "#f59e0b", "#78350f"];
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("felt")} cx="50%" cy="100%" r="95%">
          <stop offset="0%" stopColor="#292524" />
          <stop offset="100%" stopColor="#0c0a09" />
        </radialGradient>
        <linearGradient id={g("rim")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>
        <filter id={g("wheelGlow")} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("felt")})`} />
      <ellipse cx="320" cy="320" rx="220" ry="42" fill="#000" opacity="0.45" />
      <g filter={`url(#${g("wheelGlow")})`} transform={`translate(${cx} ${cy})`}>
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
              opacity="0.97"
            />
          );
        })}
        <circle r="40" fill="#1c1917" stroke={`url(#${g("rim")})`} strokeWidth="5" />
        <circle r="16" fill="#fde047" />
      </g>
      <path d="M320 36 L344 82 H296 Z" fill={`url(#${g("rim")})`} stroke="#713f12" strokeWidth="2" />
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
          <stop offset="0%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#451a03" />
        </linearGradient>
        <linearGradient id={g("gold")} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="45%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <radialGradient id={g("shine")} cx="50%" cy="0%" r="85%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <filter id={g("chest3d")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b" />
          <feOffset dx="0" dy="12" in="b" result="o" />
          <feFlood floodOpacity="0.55" result="f" />
          <feComposite in="f" in2="o" operator="in" result="s" />
          <feMerge>
            <feMergeNode in="s" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <ellipse cx="320" cy="305" rx="195" ry="32" fill="#000" opacity="0.42" />
      <g filter={`url(#${g("chest3d")})`}>
        <path d="M195 198 L320 128 L445 198 V278 H195 Z" fill={`url(#${g("wood")})`} stroke="#78350f" strokeWidth="3" />
        <path d="M188 198 H452 L320 112 Z" fill="#ca8a04" stroke={`url(#${g("gold")})`} strokeWidth="4" />
        <rect x="228" y="208" width="184" height="98" rx="8" fill="#713f12" stroke="#451a03" strokeWidth="2" />
        <rect x="284" y="238" width="72" height="54" rx="6" fill="#0f172a" stroke={`url(#${g("gold")})`} strokeWidth="3" />
        <circle cx="320" cy="262" r="15" fill={`url(#${g("gold")})`} />
        <ellipse cx="320" cy="118" rx="155" ry="38" fill={`url(#${g("shine")})`} />
      </g>
    </svg>
  );
}

function CoverFallback({ uid }: { uid: string }) {
  const g = (s: string) => `${s}-${uid}`;
  return (
    <svg className="h-full w-full" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id={g("bg")} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill={`url(#${g("bg")})`} />
      <circle cx="320" cy="180" r="70" fill="none" stroke="#fbbf24" strokeWidth="3" opacity="0.4" />
      <path
        d="M320 135 L340 175 L385 182 L352 213 L358 258 L320 235 L282 258 L288 213 L255 182 L300 175 Z"
        fill="#fde047"
        opacity="0.35"
      />
    </svg>
  );
}
