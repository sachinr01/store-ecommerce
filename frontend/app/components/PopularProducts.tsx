"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const collectionRows = [
  {
    staticSide: 'left' as const,
    staticPanel: {
      title: 'Dinnerware',
      src: '/images/collection/dinner_set_main_bn.jpeg',
      alt: 'Dinnerware Collection',
      href: '/shop/dinner-sets',
    },
    slides: [
      {
        title: 'Plates',
        src: '/images/collection/Dinner-Set-Plates.png',
        alt: 'Plates Collection',
        href: '/shop/dinner-sets',
      },
      {
        title: 'Bowls',
        src: '/images/collection/Dinner-Set-Bowls.png',
        alt: 'Bowls Collection',
        href: '/shop/serving-bowls',
      },
      {
        title: 'Platters',
        src: '/images/collection/Dinner-Set-Platter.png',
        alt: 'Platters Collection',
        href: 'shop/platters',
      },
      {
        title: 'Dinner-Sets',
        src: '/images/collection/Dinner-Sets-Dinner-Set.png',
        alt: 'Platters Collection',
        href: '/shop/dinner-sets',
      },
    ],
  },

  {
    staticSide: 'right' as const,
    staticPanel: {
      title: 'Drinkware',
      src: '/images/collection/drinkware_main_bn.jpeg',
      alt: 'Drinkware Collection',
      href: '/shop/drinkware',
    },
    slides: [
      {
        title: 'Cups & Mugs',
        src: '/images/collection/Drinkware-Cups-&-Mugs.png',
        alt: 'Cups & Mugs Collection',
        href: '/shop/cups-and-mugs',
      },
      {
        title: 'Whiskey Glass',
        src: '/images/collection/Drinkware-Whiskey-Glasses.png',
        alt: 'Whiskey Glass Collection',
        href: '/shop/whiskey-glasses',
      },
      {
        title: 'Beer Glass',
        src: '/images/collection/Drinkware-Beer-Glasses.png',
        alt: 'Beer Glass collection',
        href: '/shop/beer-mugs',
      },
      {
        title: 'Stemware',
        src: '/images/collection/Drinkware-Stemwares.png',
        alt: 'Stemware collection',
        href: '/shop/stemware',
      },
      {
        title: 'Tumblers',
        src: '/images/collection/Drinkware-Tumblers.png',
        alt: 'Tumblers collection',
        href: '/shop/tumblers',
      },
      {
        title: 'Insulated Mugs',
        src: '/images/collection/Drinkware-Insulated-Mugs.png',
        alt: 'Insulated Mugs collection',
        href: '/shop/insulated-mugs',
      },
    ],
  },

  {
    staticSide: 'left' as const,
    staticPanel: {
      title: 'Containers',
      src: '/images/collection/containers_main_bn.jpeg',
      alt: 'Containers collection',
      href: '/shop/kitchen-organisers',
    },
    slides: [
      {
        title: 'Containers',
        src: '/images/collection/Container-Contaner.png',
        alt: 'Containers collection',
        href: '/shop/kitchen-organisers',
      },
      {
        title: 'Spice Jars',
        src: '/images/collection/Container-Spice-Jar.png',
        alt: 'Spice Jars collection',
        href: '/shop/spice-jars',
      },
      {
        title: 'Spice Jars 2',
        src: '/images/collection/Container-Spice-Jars2.png',
        alt: 'Spice Jars 2 collection',
        href: '/shop/storage-jars',
      },
    ],
  },
  // {
  //   staticSide: 'right' as const,
  //   staticPanel: {
  //     title: 'Jars and Containers',
  //     src: '/images/category_images/CC_GLASSWARE.png',
  //     alt: 'Jars and containers collection',
  //     href: '/shop/jars-and-containers',
  //   },
  //   slides: [
  //     {
  //       title: 'Spice Rack',
  //       src: 'https://www.blackcarrot.in/cdn/shop/files/Black___Carrot__spice__rack.jpg?v=1769698271&width=1200',
  //       alt: 'Spice rack collection',
  //       href: '/shop/jars-and-containers',
  //     },
  //     {
  //       title: 'Storage Jars',
  //       src: 'https://www.blackcarrot.in/cdn/shop/files/BlackCarrot_Container.jpg?v=1769698426&width=1200',
  //       alt: 'Storage jars collection',
  //       href: '/shop/jars-and-containers',
  //     },
  //   ],
  // },
];

type CollectionRow = (typeof collectionRows)[number];
type CollectionPanel = CollectionRow['staticPanel'];
type CollectionSlide = CollectionRow['slides'][number];
type MobilePanel = CollectionPanel | CollectionSlide;

function StaticPanel({ panel, priority }: { panel: CollectionPanel; priority: boolean }) {
  return (
    <Link href={panel.href} className="featured-panel featured-panel-static">
      <Image
        src={panel.src}
        alt={panel.alt}
        width={1120}
        height={620}
        priority={priority}
        sizes="(max-width: 990px) 100vw, 60vw"
      />

    </Link>
  );
}

function SliderRail({ slides, priority }: { slides: CollectionSlide[]; priority: boolean }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const railSlides = slides.length > 1 ? [...slides, slides[0]] : slides;
  const activeDot = activeSlide % slides.length;
  const resetRailToStart = useCallback(() => {
    setIsTransitioning(false);
    setActiveSlide(0);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setIsTransitioning(true));
    });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsTransitioning(true);
      setActiveSlide((current) => Math.min(current + 1, slides.length));
    }, 3200);

    return () => window.clearInterval(timer);
  }, [slides.length]);

  const handleTransitionEnd = () => {
    if (activeSlide !== slides.length) return;

    resetRailToStart();
  };

  useEffect(() => {
    if (activeSlide !== slides.length) return;

    const resetTimer = window.setTimeout(resetRailToStart, 850);

    return () => window.clearTimeout(resetTimer);
  }, [activeSlide, resetRailToStart, slides.length]);

  return (
    <div className="featured-rail" aria-label="More featured categories">
      <div
        className={`featured-rail-track${isTransitioning ? '' : ' no-transition'}`}
        style={{ transform: `translate3d(-${activeSlide * 100}%, 0, 0)` }}
        onTransitionEnd={handleTransitionEnd}
      >
        {railSlides.map((slide, index) => {
          const isClone = index === slides.length;
          const isActive = index === activeSlide || (isClone && activeSlide === slides.length);

          return (
          <Link
            href={slide.href}
            className={`featured-panel featured-panel-rail ${isActive ? 'active' : ''}`}
            key={`${slide.title}-${index}`}
            aria-hidden={isActive && !isClone ? undefined : true}
            tabIndex={isActive && !isClone ? undefined : -1}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              width={760}
              height={620}
              priority={priority || index === 0}
              loading={priority || index === 0 ? undefined : 'eager'}
              sizes="(max-width: 990px) 100vw, 40vw"
            />
          </Link>
          );
        })}
      </div>
      {slides.length > 1 && (
        <span className="featured-panel-dots">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.title}
              className={index === activeDot ? 'active' : ''}
              aria-label={`Show ${slide.title}`}
              onClick={() => {
                setIsTransitioning(true);
                setActiveSlide(index);
              }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

export function FeaturedCollectionPanels() {
  const mobilePanels = collectionRows.flatMap((row) => (
    row.staticSide === 'left'
      ? [row.staticPanel, row.slides[0]]
      : [row.slides[0], row.staticPanel]
  )).filter(Boolean) as MobilePanel[];

  return (
    <section className="featured-collections-section" aria-labelledby="featured-collections-title">
      <h2 className="section-title" id="featured-collections-title">Our Collection</h2>
      <div className="featured-collections">
        {collectionRows.map((row, rowIndex) => (
          <div
            className={`featured-collection-row featured-collection-row-static-${row.staticSide}`}
            key={`${row.staticPanel.title}-${rowIndex}`}
          >
            {row.staticSide === 'left' ? (
              <>
                <StaticPanel panel={row.staticPanel} priority={rowIndex === 0} />
                <SliderRail slides={row.slides} priority={rowIndex === 0} />
              </>
            ) : (
              <>
                <SliderRail slides={row.slides} priority={rowIndex === 0} />
                <StaticPanel panel={row.staticPanel} priority={rowIndex === 0} />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="featured-mobile-grid" aria-label="Trending collections">
        {mobilePanels.map((panel, index) => (
          <Link href={panel.href} className="featured-mobile-tile" key={`${panel.title}-${index}`}>
            <Image
              src={panel.src}
              alt={panel.alt}
              width={420}
              height={520}
              sizes="50vw"
            />
            <span className="featured-mobile-shade" aria-hidden="true" />
            <span className="featured-mobile-content">
              <span className="featured-mobile-title">{panel.title}</span>
              <span className="featured-mobile-button">Explore Collection</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// export function PopularCategories() {
//   const popularCategories = [
//     'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller01-10.03.2026.jpg',
//     'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller02-10.03.2026.jpg',
//     'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller03-10.03.2026.jpg',
//     'https://icmedianew.gumlet.io/pub/media//home_banner/images/Best-Seller04-10.03.2026.jpg',
//   ];

//   return (
//     <section className="home-section home-section-no-top">
//       <h2 className="section-title">Popular Categories</h2>
//       <div className="pop-cat-grid">
//         {popularCategories.map((src, i) => (
//           <div key={i} className="pop-cat-item">
//             <Image src={src} alt={`Category ${i + 1}`} width={420} height={280} />
//           </div>
//         ))}
//       </div>
//     </section>
//   );
// }
