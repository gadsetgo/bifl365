'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ProductImageProps {
  src: string;
  alt: string;
  productId?: string;
}

export function ProductImage({ src, alt, productId }: ProductImageProps) {
  const [error, setError] = useState(false);

  // Use proxy URL if productId is provided, with fallback to direct src
  const imageSrc = productId ? `/api/image/${productId}` : src;

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center font-serif font-bold text-charcoal-400 text-opacity-50 text-2xl">
        {alt}
      </div>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill
      className="object-contain p-6"
      unoptimized
      onError={() => setError(true)}
    />
  );
}
