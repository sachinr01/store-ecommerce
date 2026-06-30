'use client';

import { useState, useRef, useCallback } from 'react';
import { useCart } from '../lib/cartContext';
import { wigzoAddToCart } from '../lib/wigzo';

interface AddToCartButtonProps {
  productId: number;
  title: string;
  image: string;
  inStock: boolean;
  className?: string;
  // Optional — when provided, enables a richer Wigzo `addtocart` event payload.
  // Falls back to safe defaults if omitted so existing callers keep working.
  price?: string | number;
  previousPrice?: string | number;
  description?: string;
  category?: string;
  productUrl?: string;
}

export default function AddToCartButton({
  productId,
  title,
  image,
  inStock,
  className = 'csp-atc-btn',
  price,
  previousPrice,
  description,
  category,
  productUrl,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [state, setState] = useState<'idle' | 'loading' | 'added' | 'error'>('idle');
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleIdRef = useRef(0);

  if (!inStock) {
    return (
      <button className={`${className} disabled`} disabled aria-label="Out of stock">
        Out of Stock
      </button>
    );
  }

  const createRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = rippleIdRef.current++;
    
    setRipples(prev => [...prev, { x, y, id }]);
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  }, []);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (state !== 'idle') return;
    
    createRipple(e);
    setState('loading');
    
    try {
      await addItem({ productId, image, quantity: 1 });
      setState('added');

      const href = typeof window !== 'undefined' ? window.location.href : '';
      wigzoAddToCart({
        canonicalURL: productUrl || href,
        productUrl: productUrl || href,
        title,
        price: String(price ?? ''),
        previousPrice: String(previousPrice ?? ''),
        description: description || '',
        image,
        productId,
        category: category || '',
      });

      // Vibration API for haptic feedback (if supported)
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      setTimeout(() => setState('idle'), 2000);
    } catch (error) {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  return (
    <button
      ref={buttonRef}
      className={`${className}${state === 'added' ? ' added' : ''}${state === 'error' ? ' error' : ''}${state === 'loading' ? ' loading' : ''}`}
      onClick={handleClick}
      disabled={state === 'loading'}
      aria-label={`Add ${title} to cart`}
      aria-live="polite"
    >
      <span className="csp-atc-content">
        {state === 'added' ? (
          <>
            <svg className="csp-atc-icon check-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="csp-atc-text">Added!</span>
          </>
        ) : state === 'error' ? (
          <>
            <svg className="csp-atc-icon error-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="csp-atc-text">Error</span>
          </>
        ) : state === 'loading' ? (
          <>
            <span className="csp-atc-spinner" aria-hidden="true" />
            <span className="csp-atc-text">Adding...</span>
          </>
        ) : (
          <>
            <svg className="csp-atc-icon cart-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            <span className="csp-atc-text">Add to Cart</span>
          </>
        )}
      </span>
      
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="csp-atc-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        />
      ))}
    </button>
  );
}
