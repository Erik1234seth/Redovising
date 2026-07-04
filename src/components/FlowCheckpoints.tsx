'use client';

import { Fragment } from 'react';

const NAV_BG = '#173b57';
const CORAL = '#E95C63';

const STEPS = [
  { n: 1, label: 'Dina uppgifter' },
  { n: 2, label: 'Betalning' },
  { n: 3, label: 'Klart' },
] as const;

export default function FlowCheckpoints({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start justify-center max-w-sm mx-auto w-full select-none">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <Fragment key={s.n}>
            <div className="flex flex-col items-center gap-2 w-20 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300"
                style={{
                  backgroundColor: done ? CORAL : active ? NAV_BG : '#e2e8f0',
                  color: done || active ? 'white' : '#94a3b8',
                }}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  s.n
                )}
              </div>
              <span
                className="text-[11px] font-semibold text-center leading-tight transition-colors duration-300"
                style={{ color: active ? NAV_BG : done ? '#64748b' : '#94a3b8' }}
              >
                {s.label}
              </span>
            </div>

            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5 rounded-full mt-4 transition-colors duration-300"
                style={{ backgroundColor: s.n < current ? CORAL : '#e2e8f0' }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
