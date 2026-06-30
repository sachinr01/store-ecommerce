import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./css/styles.css";
import { CartProvider } from "./lib/cartContext";
import { WishlistProvider } from "./lib/wishlistContext";
import { AuthProvider } from "./lib/authContext";
import { SiteSettingsProvider } from "./lib/siteSettingsContext";
import { SITE_URL } from "./lib/helpers/siteUrl";

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? 'nestcase';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Discover nestcase premium bone-ash-free crockery, lead-free glassware, 304 food-grade stainless steel cutlery, bottles and bar accessories. Shop health-friendly dinnerware at nestcase for a stylish and healthy lifestyle.',
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: [
      { url: '/images/favicon/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/images/favicon/icon-16.png',
    apple: '/images/favicon/icon-192.png',
  },
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="no-js" suppressHydrationWarning>
      <head>
        {/* Google tag (gtag.js) */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-P72E4NRVTD"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-P72E4NRVTD');
          `}
        </Script>
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/v4-shims.min.css" />
        <link rel="stylesheet" type="text/css" href="/js/specific/revolution-slider/css/settings.css" media="screen" />
        <link href="https://fonts.googleapis.com/css?family=Open+Sans:100,400,600,700,300" rel="stylesheet" type="text/css" />
        <link href="https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap" rel="stylesheet" />
        <Script
  src="https://checkout.shiprocket.in/js/sdk.js"
  strategy="beforeInteractive"
/>
        {/* Wigzo (Engage360) Mapper — must load on every page, per integration doc */}
        <Script id="wigzo-mapper" strategy="afterInteractive">
          {`
            (function(w,i,g,z,o){
            var a,m;w['WigzoObject']=o;w[o]=w[o]|| function()
            {(w[o].q=w[o].q||[]).push(arguments)},w[o].l=1* new Date()
            ;w[o].h=z;a=i.createElement(g)
            ,m=i.getElementsByTagName(g)[0];a.async=1;a.src=z;m.parentNode.insertBefore(a,m)
            }) (window,document,
            'script','//app.wigzo.com/wigzo.compressed.js','wigzo'
            ); wigzo(
            'configure', '${process.env.NEXT_PUBLIC_WIGZO_KEY || ''}'
            );
          `}
        </Script>
      </head>
      <body className="responsive" id="demo-shop" suppressHydrationWarning>
        {/*
          #sellerDomain REMOVED from here.
          It is now rendered only inside app/cart/page.tsx so Shiprocket's
          script does not auto-init on every page of the site.
        */}

        <div className="all_content" suppressHydrationWarning>
          <CartProvider>
            <AuthProvider>
              <WishlistProvider>
                <SiteSettingsProvider>
                  {children}
                </SiteSettingsProvider>
              </WishlistProvider>
            </AuthProvider>
          </CartProvider>
        </div>

        <script src="/js/core/jquery-2.1.1.min.js"></script>
        <script src="/js/core/load.js"></script>
        <script src="/js/core/jquery.easing.1.3.js"></script>
        <script src="/js/core/modernizr-2.8.2.min.js"></script>
        <script src="/js/core/imagesloaded.pkgd.min.js"></script>
        <script src="/js/core/respond.src.js"></script>
        <script src="/js/libs.js"></script>
        <script src="/js/specific/bigvideo.js"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            if (typeof jQuery !== 'undefined') {
              (function($) {
                var originalRevolution = $.fn.revolution;
                $.fn.revolution = function(options) {
                  if (this.length === 0) return this;
                  if (typeof originalRevolution === 'function') {
                    try {
                      return originalRevolution.call(this, options);
                    } catch(e) {
                      console.log('Revolution slider skipped:', e.message);
                      return this;
                    }
                  }
                  return this;
                };
              })(jQuery);
            }
          `
        }} />
        <script src="/js/main.js"></script>
      </body>
    </html>
  );
}
