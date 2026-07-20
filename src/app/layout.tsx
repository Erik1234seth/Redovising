import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import CookieConsent from "@/components/CookieConsent";
import { headers } from "next/headers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-plus-jakarta" });

export const metadata: Metadata = {
  title: "Enkla Bokslut - Årsredovisning & Bokslut för Enskild Firma | NE-bilaga",
  description: "Professionell årsredovisning och bokslut för enskilda firmor. Vi hjälper dig med NE-bilaga, förenklat årsbokslut och komplett redovisning från 299 kr/mån. Snabb leverans och experthjälp för enskild näringsidkare.",
  keywords: [
    "årsredovisning",
    "bokslut",
    "enskild firma",
    "ne-bilaga",
    "förenklat årsbokslut",
    "enskild näringsidkare",
    "redovisning",
    "bokföring enskild firma",
    "årsbokslut",
    "deklaration enskild firma",
    "skatteverket ne-bilaga",
    "enskild firma bokföring",
  ],
  authors: [{ name: "Enkla Bokslut" }],
  creator: "Enkla Bokslut",
  publisher: "Enkla Bokslut",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    url: 'https://enklabokslut.se',
    siteName: 'Enkla Bokslut',
    title: 'Enkla Bokslut - Årsredovisning & Bokslut för Enskild Firma',
    description: 'Professionell årsredovisning och bokslut för enskilda firmor. NE-bilaga, förenklat årsbokslut och deklaration från 299 kr/mån. Snabb leverans.',
    images: [
      {
        url: '/loggautantext.png',
        width: 1200,
        height: 630,
        alt: 'Enkla Bokslut - Årsredovisning för Enskild Firma',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Enkla Bokslut - Årsredovisning & Bokslut för Enskild Firma',
    description: 'Professionell årsredovisning och bokslut för enskilda firmor. NE-bilaga från 299 kr/mån. Snabb leverans.',
    images: ['/loggautantext.png'],
  },
  icons: {
    icon: '/favicon-check.svg',
    shortcut: '/favicon-check.svg',
    apple: '/favicon-check.svg',
  },
  alternates: {
    canonical: 'https://enklabokslut.se',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const isApp = headersList.get('x-is-app') === 'true';

  return (
    <html lang="sv">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-8XZDRG1PSH" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());

              gtag('config', 'G-8XZDRG1PSH');

              // Taggen laddas nu statiskt här. Markera GA som laddad så att
              // CookieConsent-komponentens egen injektion inte lägger till en
              // andra gtag.js och dubbelräknar sidvisningar.
              window.__gaLoaded = true;
            `,
          }}
        />

        {/* Meta Pixel (fbevents.js) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '2305012036917058');
              fbq('track', 'PageView');
            `,
          }}
        />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            alt=""
            src="https://www.facebook.com/tr?id=2305012036917058&ev=PageView&noscript=1"
          />
        </noscript>
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} ${plusJakarta.className}`}>
        <AuthProvider>
          {!isApp && <Navigation />}
          <main className="min-h-screen">
            {children}
          </main>
          {!isApp && <Footer />}
          {!isApp && <CookieConsent />}
        </AuthProvider>
      </body>
    </html>
  );
}
