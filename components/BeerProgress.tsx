interface BeerProgressProps {
  progress: number;
  text: string;
}

export default function BeerProgress({ progress, text }: BeerProgressProps) {
  // Calculate the path for the beer content
  const beerPath = `
      M22,118
      L78,118
      L78,${118 - progress}
      Q50,${123 - progress} 22,${118 - progress}
      Z
    `;

  // Generate foam bubbles
  const foamBubbles = Array.from({ length: 30 }, (_, i) => (
    <circle
      key={i}
      cx={25 + Math.random() * 50}
      cy={115 - progress + Math.random() * 6}
      r={1 + Math.random() * 2}
      fill="white"
      stroke="#f8f8f2"
      strokeWidth={0.5}
      opacity={0.9}
    />
  ));

  return (
    <div className="max-w-sm mx-auto">
      <div className="relative w-48 h-52">
        <svg viewBox="0 0 100 140" className="w-full h-full">
          <defs>
            <clipPath id="jugClip">
              <path d="M20,20 L20,100 Q20,120 40,120 L60,120 Q80,120 80,100 L80,20 Q80,10 70,10 L30,10 Q20,10 20,20 Z" />
            </clipPath>
          </defs>
          {/* Jug outline */}
          <path
            d="M20,20 L20,100 Q20,120 40,120 L60,120 Q80,120 80,100 L80,20 Q80,10 70,10 L30,10 Q20,10 20,20 Z"
            fill="none"
            stroke="#8B4513"
            strokeWidth="5"
          />
          {/* Handle */}
          <path
            d="M80,30 Q100,30 100,50 L100,70 Q100,90 80,90"
            fill="none"
            stroke="#8B4513"
            strokeWidth="5"
          />
          {/* Beer content */}
          <g clipPath="url(#jugClip)">
            <path d={beerPath} fill="#FFA500" />
            {/* Foam */}
            <path
              d={`M22,${115 - progress} Q50,${111 - progress} 78,${115 - progress} Q50,${119 - progress} 22,${115 - progress}`}
              fill="white"
              opacity="0.95"
            />
            {foamBubbles}
          </g>
          {/* Text in the middle of the jug */}
          <text
            x="50"
            y="70"
            textAnchor="middle"
            fill="#612C06"
            fontSize="10"
            fontWeight="bold"
            transform="rotate(-5 50 70)"
          >
            {text}
          </text>
        </svg>
      </div>
    </div>
  );
}
