'use client';

import { useEffect } from 'react';
import { useShiprocketCheckout } from '../lib/useShiprocketCheckout';

export default function CheckoutResumer() {
  const { resumeIfActive } = useShiprocketCheckout();

  useEffect(() => {
    resumeIfActive();
  }, []);

  return null;
}
