import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/contexts/AuthContext";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-plus-jakarta" });

export const metadata: Metadata = {
  title: "Enkla Bokslut - Årsredovisning & Bokslut för Enskild Firma | NE-bilaga",
  description: "Professionell årsredovisning och bokslut för enskilda firmor. Vi hjälper dig med NE-bilaga, förenklat årsbokslut och komplett redovisning från 1999kr. Snabb leverans och experthjälp för enskild näringsidkare.",
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
    description: 'Professionell årsredovisning och bokslut för enskilda firmor. NE-bilaga från 1999kr, Komplett redovisning från 3499kr. Snabb leverans.',
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
    description: 'Professionell årsredovisning och bokslut för enskilda firmor. NE-bilaga från 1999kr. Snabb leverans.',
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8XZDRG1PSH" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-8XZDRG1PSH');
        `}</Script>
      </head>
      <body className={`${inter.variable} ${plusJakarta.variable} ${plusJakarta.className}`}>
        <AuthProvider>
          <Navigation />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
