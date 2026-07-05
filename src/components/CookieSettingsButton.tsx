'use client';

const CORAL = '#E95C63';

export default function CookieSettingsButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event('open-cookie-settings'))}
      className="font-medium hover:opacity-80 transition-opacity underline"
      style={{ color: CORAL }}
    >
      ändra dina cookieinställningar
    </button>
  );
}
