import type { Metadata } from "next";
import { WatchlistClient } from "@/components/WatchlistClient";

export const metadata: Metadata = { title: "قائمة المتابعة" };

export default function WatchlistPage() {
  return <WatchlistClient />;
}
