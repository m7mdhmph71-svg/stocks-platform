import { Suspense } from "react";
import type { Metadata } from "next";
import { ScreenerClient } from "@/components/ScreenerClient";
import { ScreenerPageSkeleton } from "@/components/Skeletons";

export const metadata: Metadata = {
  title: "فرز الأسهم",
};

export default function ScreenerPage() {
  return (
    <Suspense fallback={<ScreenerPageSkeleton />}>
      <ScreenerClient />
    </Suspense>
  );
}
