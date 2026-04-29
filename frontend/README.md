# Coffr E-commerce - Next.js Conversion

This is a Next.js conversion of the original shop HTML template, maintaining pixel-perfect design and all functionality.

## 🚀 Features

- ✅ Complete HTML to React/Next.js conversion
- ✅ Revolution Slider integration
- ✅ Product filtering with Isotope
- ✅ Responsive design (desktop & mobile)
- ✅ Shopping cart functionality
- ✅ Product quick view with Magnific Popup
- ✅ All original CSS and JavaScript preserved
- ✅ Font Awesome icons
- ✅ Google Fonts (Open Sans, Lato)

## 📁 Project Structure

```
frontend/
├── app/
│   ├── components/
│   │   ├── Header.tsx          # Navigation & top bar
│   │   ├── Slider.tsx          # Revolution slider
│   │   ├── Banners.tsx         # Promotional banners
│   │   ├── NewArrivals.tsx     # New products section
│   │   ├── ProductCard.tsx     # Reusable product component
│   │   ├── SalesEvent.tsx      # Sales banner
│   │   ├── PopularProducts.tsx # Filtered products
│   │   ├── LatestPosts.tsx     # Blog section
│   │   └── Footer.tsx          # Footer with links
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page
│   └── globals.css             # Global styles
├── public/
│   ├── css/                    # All original CSS files
│   ├── js/                     # All JavaScript libraries
│   ├── images/                 # All images
│   └── fonts/                  # Font files
└── package.json
```

## 🛠️ Installation

```bash
npm install
```

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
npm run build
npm start
```

## 🎨 Design & Assets

All original design assets from the shop template have been preserved:

- **CSS**: Complete SASS/CSS structure from `shop/css/`
- **JavaScript**: jQuery plugins and libraries from `shop/js/`
- **Images**: All product images, banners, and icons from `shop/images/`
- **Fonts**: Font Awesome and custom icon fonts from `shop/fonts/`

## 🔧 Technical Details

### Key Technologies
- **Next.js 16.1.6** - React framework
- **React 19.2.3** - UI library
- **TypeScript 5** - Type safety
- **Tailwind CSS 4** - Utility-first CSS (minimal usage)
- **jQuery 2.1.1** - For legacy plugins
- **Revolution Slider** - Hero slider
- **Isotope** - Product filtering
- **Magnific Popup** - Lightbox/modal

### Script Loading Order
Scripts are loaded in the exact order as the original HTML:
1. jQuery
2. Core utilities (load.js, easing, modernizr, imagesloaded, respond)
3. libs.min.js (all plugins bundled)
4. Revolution Slider (tools + main)
5. main.js (initialization)

### Hydration Handling
- Client-side rendering for slider to avoid hydration issues
- `suppressHydrationWarning` on elements modified by jQuery
- Dynamic import with `ssr: false` for Revolution Slider component

## 📝 Components

### Header
- Desktop and mobile navigation
- Shopping cart dropdown
- Search functionality
- Multi-level menu system

### Slider
- Revolution Slider with 2 slides
- Animated captions
- Responsive images
- Touch-enabled

### Product Sections
- New Arrivals (4 products)
- Popular Products (8 products with filtering)
- Product cards with hover effects
- Sale badges
- Rating display

### Footer
- 6 column layout
- Links to policies, categories, shop sections
- Contact information
- Social media icons
- Payment method icons

## 🐛 Known Issues & Solutions

### Hydration Warnings
The application uses `suppressHydrationWarning` on elements that jQuery modifies (loading screen, isotope containers, slider). This is expected behavior when integrating legacy jQuery plugins with React.

### Revolution Slider
The slider is loaded client-side only to prevent SSR/hydration conflicts. A placeholder is shown during initial load.

## 🚀 Deployment

### Vercel (Recommended)
```bash
vercel
```

### Other Platforms
Build the production version and deploy the `.next` folder:
```bash
npm run build
```

## 📄 License

This project is a conversion of the original shop template. Please refer to the original template's license for usage rights.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Note**: This is a pixel-perfect conversion maintaining all original functionality. For a fully modern React implementation, consider refactoring jQuery dependencies to React hooks and state management.
