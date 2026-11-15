import { cn } from "@/lib/utils";

/** Parallax depth for a layer: bigger moves more when the pointer moves (inside a [data-parallax] parent). */
const depth = (d: number) => ({
  className: "plx",
  style: { "--d": d } as React.CSSProperties,
});

/**
 * The CivicAI illustration: Mysuru at sunrise — palace silhouette, Chamundi hills, and a
 * collection truck that drives along the road picking up the wheelie bins (green = wet, blue = dry). Pure SVG, no image downloads.
 * Motion only plays for people who have not asked their device to reduce motion.
 */
/** Truck loop is 10s; each bin's animation is shifted so it is "collected" exactly when the truck reaches it. */
const LOOP = 10;
const binDelay = (x: number) => `${((x + 12 - 420 * 0.5) / 420) * LOOP - LOOP}s`;
const BINS = [
  { x: 128, color: "#22c55e", lid: "#15803d", delay: binDelay(128) },
  { x: 206, color: "#3b82f6", lid: "#1d4ed8", delay: binDelay(206) },
  { x: 280, color: "#22c55e", lid: "#15803d", delay: binDelay(280) },
];

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
          <stop offset="0" stopColor="#0d5446" />
          <stop offset="0.6" stopColor="#3aa886" />
          <stop offset="1" stopColor="#ffd9a8" />
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
      <ellipse cx="200" cy="290" rx="150" ry="10" fill="#052e25" opacity="0.25" />

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
              opacity="0.8"
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
          fill="#5cb88a"
          opacity="0.6"
        />

        {/* palace silhouette */}
        <g {...depth(3)}>
          <g fill="#0c4a3c">
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
        <path d="M60 232 Q130 205 200 226 Q270 204 350 230 L350 300 L60 300 Z" fill="#0b3d32" />
        <rect x="60" y="246" width="290" height="40" fill="#082a23" />
        <path d="M70 266 H340" stroke="#bef264" strokeWidth="2" strokeDasharray="10 10" opacity="0.5" />

        {/* wheelie bins waiting on the pavement; each lifts into the truck as it passes */}
        <g {...depth(1)}>
          {BINS.map((bin) => (
            <g key={bin.x}>
              <g className="scene-bin" style={{ animationDelay: bin.delay }}>
                <rect x={bin.x - 6} y="231" width="12" height="15" rx="2" fill={bin.color} />
                <rect x={bin.x - 7} y="228" width="14" height="4" rx="1.5" fill={bin.lid} />
                <circle cx={bin.x - 4} cy="246.5" r="1.6" fill="#062a23" />
                <circle cx={bin.x + 4} cy="246.5" r="1.6" fill="#062a23" />
              </g>
              <path
                className="scene-sparkle"
                style={{ animationDelay: bin.delay }}
                d={`M${bin.x} 214 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z`}
                fill="#d9f99d"
              />
            </g>
          ))}

          {/* collection truck: drives across, loops */}
          <g className="scene-truck">
            <rect x="0" y="226" width="62" height="30" rx="5" fill="#ffffff" />
            <rect x="6" y="234" width="50" height="6" rx="3" fill="#a3e635" />
            <path d="M25 245 l4 -6 l4 6 z" fill="#16a34a" />
            <rect x="62" y="234" width="26" height="22" rx="5" fill="#ffd166" />
            <rect x="68" y="238" width="13" height="8" rx="2" fill="#0c4a3c" />
            <circle cx="16" cy="258" r="7" fill="#062a23" />
            <circle cx="16" cy="258" r="2.5" fill="#d9f99d" />
            <circle cx="76" cy="258" r="7" fill="#062a23" />
            <circle cx="76" cy="258" r="2.5" fill="#d9f99d" />
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
