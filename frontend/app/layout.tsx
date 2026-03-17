import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "./lib/cartContext";
import { WishlistProvider } from "./lib/wishlistContext";

export const metadata: Metadata = {
  title: "SHOP DEMO",
  description: "E-commerce shop",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="no-js" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="stylesheet" href="/store/css/styles-shop.css" />
        <link rel="stylesheet" type="text/css" href="/store/js/specific/revolution-slider/css/settings.css" media="screen" />
        <link href="https://fonts.googleapis.com/css?family=Open+Sans:100,400,600,700,300" rel="stylesheet" type="text/css" />
        <link href="https://fonts.googleapis.com/css?family=Lato:300,400,300italic,400italic" rel="stylesheet" type="text/css" />
        <link rel="shortcut icon" href="/store/images/favicon.png" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/store/images/favicon.png" type="image/x-icon" />
      </head>
      <body className="responsive" id="demo-shop" suppressHydrationWarning>
        <div className="all_content" suppressHydrationWarning>
          {/* Loading */}
          <div className="dima-loading" suppressHydrationWarning>
            <span className="loading-top"></span>
            <span className="loading-bottom"></span>
            <span className="spin-2"><p>LOADING</p></span>
            <a href="#" className="load-close">X</a>
          </div>
          <CartProvider>
            <WishlistProvider>
              {children}
            </WishlistProvider>
          </CartProvider>
        </div>

        {/* Load scripts in the same order as original */}
        <script src="/store/js/core/jquery-2.1.1.min.js"></script>
        <script src="/store/js/core/load.js"></script>
        <script src="/store/js/core/jquery.easing.1.3.js"></script>
        <script src="/store/js/core/modernizr-2.8.2.min.js"></script>
        <script src="/store/js/core/imagesloaded.pkgd.min.js"></script>
        <script src="/store/js/core/respond.src.js"></script>
        <script src="/store/js/libs.js"></script>
        <script src="/store/js/specific/bigvideo.js"></script>
        <script dangerouslySetInnerHTML={{
          __html: `
            // Override any revolution slider calls to prevent errors
            if (typeof jQuery !== 'undefined') {
              (function($) {
                // Store original revolution function if it exists
                var originalRevolution = $.fn.revolution;
                
                // Override to safely handle missing slider
                $.fn.revolution = function(options) {
                  if (this.length === 0) {
                    return this;
                  }
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
        <script src="/store/js/main.js"></script>
      </body>
    </html>
  );
}
