import type { Metadata } from "next";
import { PurificationClient } from "@/components/PurificationClient";

export const metadata: Metadata = {
  title: "تطهير محفظتي",
  description:
    "حساب تلقائي لمبلغ التطهير المستحق عن صفقاتك المغلقة: الربح المحقق × نسبة تطهير كل سهم، بإجماليات شهرية وسنوية.",
};

export default function PurificationPage() {
  return <PurificationClient />;
}
