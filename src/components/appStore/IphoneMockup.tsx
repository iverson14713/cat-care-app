import type { ReactNode } from 'react';
import {
  DEVICE_LOGICAL_W,
  PHONE_BEZEL,
  PHONE_FRAME_RADIUS,
  PHONE_MOCKUP_SCALE,
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
  const islandTop = Math.round(16 * (PHONE_SCREEN_W / 612));
  const islandW = Math.round(118 * (PHONE_SCREEN_W / 612));
  const islandH = Math.round(30 * (PHONE_SCREEN_W / 612));
  const sideBtnW = Math.max(3, Math.round(4 * PHONE_MOCKUP_SCALE));
  const sideBtnH = Math.round(56 * (PHONE_SCREEN_W / 612));

  return (
    <section
      className="relative shrink-0"
      style={{ width: outerW, height: outerH }}
      aria-hidden
    >
      <span
        className="absolute inset-0 bg-gradient-to-b from-stone-800 to-stone-950"
        style={{
          borderRadius: PHONE_FRAME_RADIUS,
          boxShadow:
            '0 48px 96px -24px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      />
      <span
        className="absolute rounded-sm bg-stone-700"
        style={{ left: -sideBtnW, top: '22%', width: sideBtnW, height: sideBtnH }}
      />
      <span
        className="absolute rounded-sm bg-stone-700"
        style={{ right: -sideBtnW, top: '28%', width: sideBtnW, height: sideBtnH * 0.72 }}
      />
      <span
        className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-black"
        style={{
          top: islandTop + PHONE_BEZEL,
          width: islandW,
          height: islandH,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
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
        <span
          className="pointer-events-none absolute bottom-2 left-1/2 z-10 h-1 -translate-x-1/2 rounded-full bg-stone-900/25"
          style={{ width: Math.round(96 * (PHONE_SCREEN_W / 612)) }}
        />
      </span>
    </section>
  );
}
