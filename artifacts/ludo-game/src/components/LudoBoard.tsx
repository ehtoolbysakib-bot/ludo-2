import React from 'react';
import { PATH_COORDS, HOME_RUN_COORDS, START_INDICES, SAFE_SQUARES, COLORS } from '@/lib/ludo-utils';
import { Star } from 'lucide-react';

export type TokenState = 'home' | 'active' | 'finished';
export interface Token {
  id: string;
  color: 'red' | 'blue' | 'green' | 'yellow';
  state: TokenState;
  position: number; // 0-51 for outer path, 0-4 for home run
}

interface LudoBoardProps {
  tokens: Token[];
  onTokenClick?: (tokenId: string) => void;
  activeColor?: string;
  allowedTokens?: string[];
}

export function LudoBoard({ tokens, onTokenClick, activeColor, allowedTokens = [] }: LudoBoardProps) {
  const cellSize = 100 / 15; // percentages
  
  // Renders a single cell
  const renderCell = (x: number, y: number, color: string = 'white', isStar: boolean = false, isSafe: boolean = false) => {
    return (
      <g key={`cell-${x}-${y}`} transform={`translate(${x * cellSize}, ${y * cellSize})`}>
        <rect width={cellSize} height={cellSize} fill={color} stroke="#3a2382" strokeWidth="0.2" />
        {isStar && (
          <g transform={`translate(${cellSize/2}, ${cellSize/2}) scale(0.04)`}>
            <path d="M0 -15 L4 -4 L15 -4 L6 3 L10 14 L0 7 L-10 14 L-6 3 L-15 -4 L-4 -4 Z" fill="rgba(255,255,255,0.6)" />
          </g>
        )}
      </g>
    );
  };

  // Render home bases
  const renderHomeBase = (color: string, x: number, y: number, colorVal: string) => {
    return (
      <g key={`home-${color}`} transform={`translate(${x * cellSize}, ${y * cellSize})`}>
        <rect width={cellSize * 6} height={cellSize * 6} fill={colorVal} stroke="#3a2382" strokeWidth="0.5" />
        <rect x={cellSize} y={cellSize} width={cellSize * 4} height={cellSize * 4} fill="white" rx="1" />
        {/* Token placeholders */}
        {[
          { cx: cellSize * 2, cy: cellSize * 2 },
          { cx: cellSize * 4, cy: cellSize * 2 },
          { cx: cellSize * 2, cy: cellSize * 4 },
          { cx: cellSize * 4, cy: cellSize * 4 }
        ].map((pos, i) => (
          <circle key={`ph-${i}`} cx={pos.cx} cy={pos.cy} r={cellSize * 0.8} fill={colorVal} opacity="0.3" />
        ))}
      </g>
    );
  };

  // Center finish area
  const renderCenter = () => {
    return (
      <g transform={`translate(${6 * cellSize}, ${6 * cellSize})`}>
        <polygon points={`0,0 ${cellSize*1.5},${cellSize*1.5} 0,${cellSize*3}`} fill={COLORS.blue} />
        <polygon points={`0,0 ${cellSize*3},0 ${cellSize*1.5},${cellSize*1.5}`} fill={COLORS.red} />
        <polygon points={`${cellSize*3},0 ${cellSize*3},${cellSize*3} ${cellSize*1.5},${cellSize*1.5}`} fill={COLORS.green} />
        <polygon points={`0,${cellSize*3} ${cellSize*1.5},${cellSize*1.5} ${cellSize*3},${cellSize*3}`} fill={COLORS.yellow} />
      </g>
    );
  };

  // Draw tokens
  const renderTokens = () => {
    // Group tokens by physical position to stack them if needed
    const positionMap: Record<string, Token[]> = {};
    
    tokens.forEach(t => {
      let x, y;
      if (t.state === 'home') {
        const hx = t.color === 'blue' ? 0 : t.color === 'red' ? 9 : t.color === 'green' ? 9 : 0;
        const hy = t.color === 'blue' ? 0 : t.color === 'red' ? 0 : t.color === 'green' ? 9 : 9;
        const idx = parseInt(t.id.split('-')[1]);
        const px = idx % 2 === 0 ? 2 : 4;
        const py = idx < 2 ? 2 : 4;
        x = hx + px;
        y = hy + py;
      } else if (t.state === 'active') {
        const coord = PATH_COORDS[t.position];
        x = coord.x + 0.5;
        y = coord.y + 0.5;
      } else if (t.state === 'finished') {
        const coord = HOME_RUN_COORDS[t.color][t.position]; // position 0-4
        x = coord.x + 0.5;
        y = coord.y + 0.5;
      }
      
      const key = `${x},${y}`;
      if (!positionMap[key]) positionMap[key] = [];
      positionMap[key].push(t);
    });

    return Object.entries(positionMap).map(([key, tks]) => {
      const [x, y] = key.split(',').map(Number);
      
      return tks.map((t, idx) => {
        const isClickable = allowedTokens.includes(t.id);
        const offset = tks.length > 1 ? (idx - (tks.length-1)/2) * 1.5 : 0;
        
        return (
          <g 
            key={t.id} 
            transform={`translate(${x * cellSize + offset}, ${y * cellSize + offset})`}
            onClick={() => isClickable && onTokenClick?.(t.id)}
            style={{ cursor: isClickable ? 'pointer' : 'default' }}
            className={`transition-all duration-300 ${isClickable ? 'animate-pulse' : ''}`}
          >
            {isClickable && <circle cx="0" cy="0" r={cellSize * 0.6} fill="white" className="animate-ping opacity-50" />}
            <circle cx="0" cy="0" r={cellSize * 0.4} fill={COLORS[t.color]} stroke="white" strokeWidth="0.3" 
                    className="drop-shadow-lg" />
            {/* Token highlight */}
            <circle cx="-1" cy="-1" r={cellSize * 0.15} fill="white" opacity="0.4" />
          </g>
        );
      });
    });
  };

  return (
    <div className="w-full aspect-square max-w-[500px] mx-auto bg-[#1a0533] p-2 rounded-2xl glow-box border border-[#5c3eb8] shadow-2xl">
      <svg width="100%" height="100%" viewBox="0 0 100 100" className="bg-[#1d0f3d] rounded-xl">
        {/* Draw Path */}
        {PATH_COORDS.map((c, i) => {
          const isStar = SAFE_SQUARES.includes(i);
          let color = '#2d1b69'; // default path color
          if (i === START_INDICES.blue) color = COLORS.blue;
          if (i === START_INDICES.red) color = COLORS.red;
          if (i === START_INDICES.green) color = COLORS.green;
          if (i === START_INDICES.yellow) color = COLORS.yellow;
          
          if (isStar && !Object.values(START_INDICES).includes(i)) color = '#3a2382'; // Safe star cells
          
          return renderCell(c.x, c.y, color, isStar);
        })}

        {/* Draw Home Runs */}
        {Object.entries(HOME_RUN_COORDS).map(([color, coords]) => 
          coords.map((c, i) => renderCell(c.x, c.y, COLORS[color as keyof typeof COLORS]))
        )}

        {/* Home Bases */}
        {renderHomeBase('blue', 0, 0, COLORS.blue)}
        {renderHomeBase('red', 9, 0, COLORS.red)}
        {renderHomeBase('green', 9, 9, COLORS.green)}
        {renderHomeBase('yellow', 0, 9, COLORS.yellow)}

        {/* Center */}
        {renderCenter()}

        {/* Tokens */}
        {renderTokens()}
      </svg>
    </div>
  );
}
