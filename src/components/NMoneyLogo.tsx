import React from 'react';

interface NMoneyLogoProps {
  /** sm=36px · md=40px · lg=48px */
  size?: 'sm' | 'md' | 'lg';
  /** blue = solid #1E56A0 bg (on light surfaces) · glass = white/20 bg (on dark/gradient surfaces) */
  variant?: 'blue' | 'glass';
  className?: string;
}

const sizeMap = {
  sm: { box: 'w-9 h-9',   text: 'text-[11px]' },
  md: { box: 'w-10 h-10', text: 'text-xs'     },
  lg: { box: 'w-12 h-12', text: 'text-sm'     },
};

const NMoneyLogo: React.FC<NMoneyLogoProps> = ({
  size = 'md',
  variant = 'blue',
  className = '',
}) => {
  const { box, text } = sizeMap[size];
  const bg = variant === 'glass' ? 'bg-white/20' : 'bg-[#1E56A0]';

  return (
    <div
      className={`${box} ${bg} rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${className}`}
      aria-label="N.Money"
    >
      {/* Two-line stacked monogram: N over M with a thin divider */}
      <span className={`${text} font-black text-white leading-none tracking-tight`}>N</span>
      <span className="w-3/4 h-px bg-white/50 my-0.5" />
      <span className={`${text} font-black text-white leading-none tracking-tight`}>M</span>
    </div>
  );
};

export default NMoneyLogo;
