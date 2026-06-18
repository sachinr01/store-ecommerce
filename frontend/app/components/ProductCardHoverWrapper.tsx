'use client';

import { useState } from 'react';

interface ProductCardHoverWrapperProps {
  className?: string;
  style?: React.CSSProperties;
  children: (cardHovered: boolean) => React.ReactNode;
}

export default function ProductCardHoverWrapper({
  className,
  style,
  children,
}: ProductCardHoverWrapperProps) {
  const [cardHovered, setCardHovered] = useState(false);

  return (
    <div
      className={className}
      style={style}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
    >
      {children(cardHovered)}
    </div>
  );
}
