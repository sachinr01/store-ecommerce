'use client';

import './home.css';
import Header from './components/Header';
import Slider from './components/Slider';
import TrendingCategories from './components/Banners';
import NewlyLaunched from './components/NewArrivals';
import VideoBanner from './components/SalesEvent';
import CuratedGifting from './components/PopularProducts';
import LatestPosts from './components/LatestPosts';
import Footer from './components/Footer';

export default function Home() {
  return (
    <>
      <div className="ann-bar">
        FREE SHIPPING ON ORDERS ABOVE $99 &nbsp;|&nbsp; ✦ SPRING SUMMER 2026: NOW LIVE ✦
      </div>
      <Header />
      <Slider />
      <TrendingCategories />
      <NewlyLaunched />
      <VideoBanner />
      <CuratedGifting />
      <LatestPosts />
      <Footer />
    </>
  );
}
