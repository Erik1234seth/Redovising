'use client';

interface VideoPlayerProps {
  videoUrl: string;
  title: string;
}

export default function VideoPlayer({ videoUrl, title }: VideoPlayerProps) {
  return (
    <div className="bg-navy-900 border border-navy-600 rounded-xl overflow-hidden shadow-xl">
      <div className="aspect-video bg-navy-800 flex items-center justify-center">
        {/* Placeholder för video - du kan byta ut detta mot en riktig video-komponent senare */}
        <div className="text-center text-white p-8">
          <div className="w-20 h-20 bg-gold-500/10 border-2 border-gold-500/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-gold-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-white mb-2">{title}</p>
          <p className="text-sm text-warm-400 mt-2">Video: {videoUrl}</p>
          <p className="text-xs text-warm-500 mt-4 bg-navy-700/50 px-4 py-2 rounded-lg inline-block">
            (Lägg till dina instruktionsvideor här)
          </p>
        </div>
      </div>
    </div>
  );
}
