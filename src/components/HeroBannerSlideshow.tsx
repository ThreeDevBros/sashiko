import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { BannerItem } from '@/components/admin/HomePageViewSection';

interface HeroBannerSlideshowProps {
  banners: BannerItem[];
  intervalSeconds: number;
  children: (currentBanner: BannerItem) => React.ReactNode;
}

export function HeroBannerSlideshow({ banners, intervalSeconds, children }: HeroBannerSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % banners.length);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(next, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [next, intervalSeconds, banners.length]);

  const currentBanner = banners[currentIndex];
  if (!currentBanner) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <img
            src={currentBanner.image_url}
            alt={currentBanner.title || 'Banner'}
            className="w-full h-full object-cover"
            style={{
              objectPosition: `${currentBanner.focus_x}% ${currentBanner.focus_y}%`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white w-6' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Content overlay */}
      <div className="relative z-[5] h-full">
        {children(currentBanner)}
      </div>
    </>
  );
}
