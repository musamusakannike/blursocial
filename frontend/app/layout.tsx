import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import FloatingDots from "@/components/Floaties";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Blur - Anonymous Chat Rooms",
    template: "%s | Blur"
  },
  description: "Create secure, password-protected chat rooms and share them instantly. Blur offers a private, anonymous, and real-time messaging experience.",
  keywords: ["anonymous chat", "private messaging", "secure chat", "no-log chat", "blur social"],
  authors: [{ name: "Blur Team" }],
  creator: "Blur",
  publisher: "Blur",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL("https://blursocial.codiac.online"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Blur - Anonymous Chat Rooms",
    description: "Create secure, password-protected chat rooms and share them instantly.",
    url: "https://blursocial.codiac.online",
    siteName: "Blur",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Blur - Anonymous Chat Rooms",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blur - Anonymous Chat Rooms",
    description: "Create secure, password-protected chat rooms and share them instantly.",
    images: ["/og-image.png"],
    creator: "@blursocial",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="en">
      <body className="relative min-h-screen" suppressHydrationWarning>
        {/* Dots go first (Background Layer) */}
        <FloatingDots />

        {/* Content goes second (Foreground Layer) */}
        <div className="relative z-10">
          {children}
        </div>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              fontSize: '14px',
              fontFamily: 'Outfit, sans-serif',
            },
            success: {
              iconTheme: {
                primary: 'var(--success)',
                secondary: 'var(--bg-elevated)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--error)',
                secondary: 'var(--bg-elevated)',
              },
            },
          }}
        />
      </body>
    </html>
  );
}
