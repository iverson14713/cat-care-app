import type { ReactNode } from 'react';
import {
  DEVICE_LOGICAL_W,
  PHONE_BEZEL,
  PHONE_FRAME_RADIUS,
  PHONE_SCREEN_H,
  PHONE_SCREEN_RADIUS,
  PHONE_SCREEN_W,
  SCREEN_SCALE,
} from './constants';

type IphoneMockupProps = {
  children: ReactNode;
};

export function IphoneMockup({ children }: IphoneMockupProps) {
  const outerW = PHONE_SCREEN_W + PHONE_BEZEL * 2;
  const outerH = PHONE_SCREEN_H + PHONE_BEZEL * 2;
  const islandTop = Math.round(18 * (PHONE_SCREEN_W / 612));
  const islandW = Math.round(110 * (PHONE_SCREEN_W / 612));
  const islandH = Math.round(28 * (PHONE_SCREEN_W / 612));

  return (
    <section
      className="relative shrink-0"
      style={{ width: outerW, height: outerH }}
      aria-hidden
    >
      <span
        className="absolute inset-0 bg-stone-900"
        style={{
          borderRadius: PHONE_FRAME_RADIUS,
          boxShadow:
            '0 40px 80px -20px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.08)',
        }}
      />
      <span
        className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
        style={{
          top: islandTop,
          width: islandW,
          height: islandH,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      />
      <span
        className="absolute overflow-hidden bg-[#faf8f5]"
        style={{
          left: PHONE_BEZEL,
          top: PHONE_BEZEL,
          width: PHONE_SCREEN_W,
          height: PHONE_SCREEN_H,
          borderRadius: PHONE_SCREEN_RADIUS,
        }}
      >
        <span
          className="origin-top-left"
          style={{
            width: DEVICE_LOGICAL_W,
            height: PHONE_SCREEN_H / SCREEN_SCALE,
            transform: `scale(${SCREEN_SCALE})`,
            transformOrigin: 'top left',
            display: 'block',
          }}
        >
          {children}
        </span>
      </span>
    </section>
  );
}
