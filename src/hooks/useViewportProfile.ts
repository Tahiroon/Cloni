import { useEffect, useState } from 'react';

export interface ViewportProfile {
  width: number;
  height: number;
  isPhone: boolean;
  isDesktopOrTablet: boolean;
  isLargeDesktop: boolean;
  hasFinePointer: boolean;
  isKeyboardMouseActive: boolean;
}

const readInitialProfile = (): ViewportProfile => {
  if (typeof window === 'undefined') {
    return {
      width: 390,
      height: 844,
      isPhone: true,
      isDesktopOrTablet: false,
      isLargeDesktop: false,
      hasFinePointer: false,
      isKeyboardMouseActive: false,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPhone = width < 768;
  const isDesktopOrTablet = width >= 768;
  const isLargeDesktop = width >= 1024;
  const hasFinePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: fine)').matches ||
        window.matchMedia('(any-pointer: fine)').matches
      : !('ontouchstart' in window);
  return {
    width,
    height,
    isPhone,
    isDesktopOrTablet,
    isLargeDesktop,
    hasFinePointer,
    isKeyboardMouseActive: isDesktopOrTablet && hasFinePointer,
  };
};

export function useViewportProfile(): ViewportProfile {
  const [profile, setProfile] = useState<ViewportProfile>(readInitialProfile);

  useEffect(() => {
    const syncViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPhone = width < 768;
      const isDesktopOrTablet = width >= 768;
      const isLargeDesktop = width >= 1024;
      const hasFinePointer =
        typeof window.matchMedia === 'function'
          ? window.matchMedia('(pointer: fine)').matches ||
            window.matchMedia('(any-pointer: fine)').matches
          : !('ontouchstart' in window);

      setProfile((prev) => {
        const nextKbMouse = isPhone
          ? false
          : hasFinePointer
            ? prev.isKeyboardMouseActive || !prev.isDesktopOrTablet
            : false;
        if (
          prev.width === width &&
          prev.height === height &&
          prev.hasFinePointer === hasFinePointer &&
          prev.isKeyboardMouseActive === nextKbMouse
        ) {
          return prev;
        }
        return {
          width,
          height,
          isPhone,
          isDesktopOrTablet,
          isLargeDesktop,
          hasFinePointer,
          isKeyboardMouseActive: nextKbMouse,
        };
      });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (window.innerWidth < 768) return;
      if (e.pointerType === 'touch') {
        setProfile((prev) =>
          prev.isKeyboardMouseActive ? { ...prev, isKeyboardMouseActive: false } : prev
        );
      } else if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
        setProfile((prev) =>
          !prev.isKeyboardMouseActive ? { ...prev, isKeyboardMouseActive: true } : prev
        );
      }
    };

    const onKeyDown = () => {
      if (window.innerWidth < 768) return;
      setProfile((prev) =>
        !prev.isKeyboardMouseActive ? { ...prev, isKeyboardMouseActive: true } : prev
      );
    };

    window.addEventListener('resize', syncViewport);
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: true });
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return profile;
}
