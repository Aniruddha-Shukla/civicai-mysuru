import { cn } from "@/lib/utils";

/** Parallax depth for a layer: bigger moves more when the pointer moves (inside a [data-parallax] parent). */
const depth = (d: number) => ({
  className: "plx",
  style: { "--d": d } as React.CSSProperties,
});

/**
 * The CivicAI illustration: Mysuru at dusk — palace silhouette, hills, a twinkling sky
 * and a waste-collection truck driving along the road. Pure SVG, no image downloads.
 * Motion only plays for people who have not asked their device to reduce motion.
 */
export function CityScene({ className, id = "scene" }: { className?: string; id?: string }) {
  const sky = `${id}-sky`;
  const sun = `${id}-sun`;
  const clip = `${id}-clip`;
  const stars: [number, number, number][] = [
    [120, 70, 1.6],
    [150, 48, 1.2],
    [176, 82, 1],
    [262, 58, 1.4],
    [290, 92, 1.1],
    [228, 40, 1],
    [104, 112, 1],
    [312, 128, 1.3],
    [200, 62, 0.9],
    [138, 140, 0.8],
    [250, 120, 0.8],
  ];

  return (
    <svg viewBox="0 0 400 320" className={cn("h-auto w-full", className)} role="img" aria-hidden focusable="false">
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b28a8" />
          <stop offset="0.65" stopColor="#6a4be6" />
          <stop offset="1" stopColor="#9b82ff" />
        </linearGradient>
        <radialGradient id={sun} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff2b3" />
          <stop offset="0.6" stopColor="#ffd166" />
          <stop offset="1" stopColor="#ffb547" />
        </radialGradient>
        <clipPath id={clip}>
          <circle cx="200" cy="150" r="128" />
        </clipPath>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="200" cy="290" rx="150" ry="10" fill="#1e1460" opacity="0.25" />

      <circle cx="200" cy="150" r="128" fill={`url(#${sky})`} />
      <g clipPath={`url(#${clip})`}>
        <g {...depth(-8)}>
          {stars.map(([x, y, r], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill="#fff"
              className="motion-safe:animate-twinkle"
              style={{ animationDelay: `${(i % 5) * 0.6}s` }}
            />
          ))}
          <path d="M108 60 l26 -14" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M288 140 l22 -12" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
        </g>

        {/* setting sun */}
        <g {...depth(12)}>
          <circle cx="236" cy="108" r="26" fill={`url(#${sun})`} />
          <circle cx="236" cy="108" r="38" fill="#ffd166" opacity="0.12" />
        </g>

        {/* far hills (Chamundi) */}
        <path
          {...depth(5)}
          d="M40 210 Q110 150 165 190 Q215 140 270 185 Q310 160 370 200 L370 300 L40 300 Z"
          fill="#7c62f0"
          opacity="0.65"
        />

        {/* palace silhouette */}
        <g {...depth(3)}>
          <g fill="#33238f">
            <rect x="146" y="186" width="108" height="34" />
            <rect x="184" y="150" width="32" height="40" />
            <path d="M180 152 Q200 112 220 152 Z" />
            <rect x="198.5" y="112" width="3" height="10" />
            <rect x="152" y="166" width="16" height="24" />
            <path d="M150 168 Q160 148 170 168 Z" />
            <rect x="232" y="166" width="16" height="24" />
            <path d="M230 168 Q240 148 250 168 Z" />
            <rect x="126" y="196" width="22" height="24" />
            <rect x="252" y="196" width="22" height="24" />
          </g>
          <g fill="#ffd166" opacity="0.9">
            {[156, 172, 188, 204, 220, 236].map((x) => (
              <rect key={x} x={x} y="198" width="5" height="7" rx="1" />
            ))}
            <rect x="196" y="162" width="8" height="10" rx="4" />
          </g>
        </g>

        {/* near hills and road */}
        <path d="M60 232 Q130 205 200 226 Q270 204 350 230 L350 300 L60 300 Z" fill="#2a1d80" />
        <rect x="60" y="246" width="290" height="40" fill="#1f1566" />
        <path d="M70 266 H340" stroke="#a594ff" strokeWidth="2" strokeDasharray="10 10" opacity="0.6" />

        {/* waste-collection truck */}
        <g {...depth(1)}>
          <g className="motion-safe:animate-drive">
            <rect x="146" y="226" width="62" height="30" rx="5" fill="#ffffff" />
            <rect x="152" y="234" width="50" height="6" rx="3" fill="#34d399" />
            <path d="M171 245 l4 -6 l4 6 z" fill="#34d399" />
            <rect x="208" y="234" width="26" height="22" rx="5" fill="#ffd166" />
            <rect x="214" y="238" width="13" height="8" rx="2" fill="#3b28a8" />
            <circle cx="162" cy="258" r="7" fill="#140d45" />
            <circle cx="162" cy="258" r="2.5" fill="#c9c0ff" />
            <circle cx="222" cy="258" r="7" fill="#140d45" />
            <circle cx="222" cy="258" r="2.5" fill="#c9c0ff" />
          </g>
        </g>
      </g>

      {/* clouds outside the circle, like a sticker */}
      <g {...depth(18)}>
        <g fill="#ffffff" className="motion-safe:animate-float">
          <path d="M30 196 q6 -16 24 -12 q8 -14 26 -6 q16 -4 18 12 q12 2 10 12 H32 q-12 -2 -2 -6 z" opacity="0.9" />
          <path d="M300 92 q4 -12 18 -9 q6 -10 20 -4 q12 -2 14 9 q9 2 7 9 H302 q-9 -1 -2 -5 z" opacity="0.85" />
        </g>
        <g fill="#ffffff" opacity="0.75">
          <rect x="18" y="232" width="56" height="5" rx="2.5" />
          <rect x="40" y="244" width="30" height="5" rx="2.5" />
          <rect x="320" y="236" width="62" height="5" rx="2.5" />
          <rect x="336" y="248" width="30" height="5" rx="2.5" />
        </g>
      </g>
    </svg>
  );
}
