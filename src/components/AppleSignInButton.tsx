type AppleSignInButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

/** Sign in with Apple — follows Apple HIG (dark button, centered logo mark). */
export function AppleSignInButton({ label, disabled, onClick }: AppleSignInButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-55"
      aria-label={label}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.05 20.28c-.98.95-2.05 1.7-3.4 1.7-1.34 0-1.75-.79-3.26-.79-1.5 0-1.96.77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C2.79 17.25 1.4 12.45 3.03 8.67c.81-1.79 2.28-2.92 4.12-2.95 1.28-.02 2.5.87 3.27.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      {label}
    </button>
  );
}
