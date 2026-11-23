import { createContext, useContext } from 'react';

export type FppOrientationMode = 'auto' | 'landscape' | 'portrait';
export type CssRotationDeg = 0 | 90 | -90;

export const CssRotationContext = createContext<CssRotationDeg>(0);
export const useCssRotation = (): CssRotationDeg => useContext(CssRotationContext);

export interface FppViewportGeometry {
  cssRotation: CssRotationDeg;
  visualWidth: number;
  visualHeight: number;
  isLandscape: boolean;
  isCompactLandscape: boolean;
  isTabletLandscape: boolean;
}

export function computeFppViewportGeometry(
  windowWidth: number,
  windowHeight: number,
  fppActive: boolean,
  orientationMode: FppOrientationMode
): FppViewportGeometry {
  const isPhysicalLandscape = windowWidth > windowHeight;
  let cssRotation: CssRotationDeg = 0;

  if (fppActive) {
    if (orientationMode === 'landscape' && !isPhysicalLandscape) {
      cssRotation = 90;
    } else if (orientationMode === 'portrait' && isPhysicalLandscape) {
      cssRotation = -90;
    }
  }

  const visualWidth = cssRotation !== 0 ? windowHeight : windowWidth;
  const visualHeight = cssRotation !== 0 ? windowWidth : windowHeight;
  const isLandscape = visualWidth > visualHeight;
  const isCompactLandscape = isLandscape && visualHeight < 560;
  const isTabletLandscape = isLandscape && visualHeight >= 560;

  return {
    cssRotation,
    visualWidth,
    visualHeight,
    isLandscape,
    isCompactLandscape,
    isTabletLandscape,
  };
}

export async function applyNativeScreenOrientation(
  target: FppOrientationMode,
  options?: { enterFullscreen?: boolean; exitFullscreen?: boolean }
): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  try {
    if (options?.enterFullscreen && !document.fullscreenElement) {
      const root = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {});
      } else if (typeof root.webkitRequestFullscreen === 'function') {
        await Promise.resolve(root.webkitRequestFullscreen()).catch(() => {});
      }
    } else if (options?.exitFullscreen && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
  } catch {
    // Fullscreen blocked by browser or iframe sandbox; CSS layout fallback handles it seamlessly
  }

  try {
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & {
          lock?: (orientation: string) => Promise<void>;
          unlock?: () => void;
        })
      | undefined;
    if (!orientation) return;

    if (target === 'auto') {
      if (typeof orientation.unlock === 'function') {
        orientation.unlock();
      }
    } else if (typeof orientation.lock === 'function') {
      await orientation.lock(target === 'landscape' ? 'landscape' : 'portrait').catch(() => {});
    }
  } catch {
    // Orientation lock unsupported (e.g. iOS Safari / desktop / iframe); CSS rotation fallback activates immediately
  }
}

export function toggleNativeFullscreen(wantFullscreen: boolean): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  try {
    if (wantFullscreen && !document.fullscreenElement) {
      const root = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (typeof root.requestFullscreen === 'function') {
        return root.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {});
      }
      if (typeof root.webkitRequestFullscreen === 'function') {
        return Promise.resolve(root.webkitRequestFullscreen()).catch(() => {});
      }
    } else if (!wantFullscreen && document.fullscreenElement) {
      return document.exitFullscreen().catch(() => {});
    }
  } catch {
    // Ignore unsupported environments
  }
  return Promise.resolve();
}

export function mapClientToRotatedNdc(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cssRotation: CssRotationDeg
): { x: number; y: number } {
  const rw = Math.max(1, rect.width);
  const rh = Math.max(1, rect.height);
  if (cssRotation === 90) {
    const u = (clientY - rect.top) / rh;
    const v = (rect.right - clientX) / rw;
    return { x: u * 2 - 1, y: -(v * 2 - 1) };
  }
  if (cssRotation === -90) {
    const u = (rect.bottom - clientY) / rh;
    const v = (clientX - rect.left) / rw;
    return { x: u * 2 - 1, y: -(v * 2 - 1) };
  }
  return {
    x: ((clientX - rect.left) / rw) * 2 - 1,
    y: -((clientY - rect.top) / rh) * 2 + 1,
  };
}

export function mapClientDeltaForRotation(
  rawDx: number,
  rawDy: number,
  cssRotation: CssRotationDeg
): { dx: number; dy: number } {
  if (cssRotation === 90) return { dx: rawDy, dy: -rawDx };
  if (cssRotation === -90) return { dx: -rawDy, dy: rawDx };
  return { dx: rawDx, dy: rawDy };
}

export function getRotatedPadDelta(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cssRotation: CssRotationDeg
): { dx: number; dy: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return mapClientDeltaForRotation(clientX - cx, clientY - cy, cssRotation);
}

export function getRotatedSliderFraction(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  cssRotation: CssRotationDeg
): number {
  let raw = 0;
  if (cssRotation === 90) {
    raw = (clientY - rect.top) / Math.max(1, rect.height);
  } else if (cssRotation === -90) {
    raw = (rect.bottom - clientY) / Math.max(1, rect.height);
  } else {
    raw = (clientX - rect.left) / Math.max(1, rect.width);
  }
  return Math.max(0, Math.min(1, raw));
}
