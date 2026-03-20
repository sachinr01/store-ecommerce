"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PrivacyPolicy from "../PrivacyPolicy";
import TermsAndConditionsPage from "../TermsAndConditions";
import ReturnPolicyPage from "../ReturnPolicy";
import RefundPolicyPage from "../RefundPolicy";
import CancellationPolicyPage from "../CancellationPolicy";
import GiftVoucherTCPage from "../GiftVoucherTC";

function PolicyContent() {
  const searchParams = useSearchParams();
  const policyType = searchParams.get("type") || "privacy-policy";

  const renderPolicy = () => {
    switch (policyType) {
      case "privacy-policy":
        return <PrivacyPolicy />;
      case "terms-and-conditions":
        return <TermsAndConditionsPage />;
      case "return-policy":
        return <ReturnPolicyPage />;
      case "refund-policy":
        return <RefundPolicyPage />;
      case "cancellation-policy":
        return <CancellationPolicyPage />;
      case "gift-voucher":
        return <GiftVoucherTCPage />;
      default:
        return <PrivacyPolicy />;
    }
  };

  return <>{renderPolicy()}</>;
}

export default function PolicyNavPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PolicyContent />
    </Suspense>
  );
}
