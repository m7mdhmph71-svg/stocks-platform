import type { Metadata } from "next";
import { ResetClient } from "@/components/ResetClient";

export const metadata: Metadata = {
  title: "استرجاع كلمة المرور",
  description: "استرجع الوصول لحسابك برمز يصلك عبر البريد أو واتساب.",
};

export default function ResetPage() {
  return <ResetClient />;
}
