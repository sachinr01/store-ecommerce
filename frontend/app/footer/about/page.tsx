"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AboutUsPage from "./About-us";
import PressPage from "./Press";
import StoreLocatorPage from "./Store-locator";
import TrackOrderPage from "./Track-order";
import CustomerSupportPage from "./Customer-support";
import CareersPage from "./Careers";

function AboutPageContent() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") || "about").toLowerCase();

  switch (tab) {
    case "press":
      return <PressPage />;
    case "store-locator":
      return <StoreLocatorPage />;
    case "track-order":
      return <TrackOrderPage />;
    case "customer-support":
      return <CustomerSupportPage />;
    case "careers":
      return <CareersPage />;
    case "about":
    default:
      return <AboutUsPage />;
  }
}

export default function AboutPageRouter() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AboutPageContent />
    </Suspense>
  );
}
