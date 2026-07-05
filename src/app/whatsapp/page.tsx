import type { Metadata } from "next";
import { WhatsAppClient } from "@/components/WhatsAppClient";

export const metadata: Metadata = {
  title: "تنبيهات واتساب",
  description:
    "اربط واتسابك من حسابك مباشرة: امسح رمز QR واستقبل إشارات اليوم وتنبيهات الصفقات وتغيّر الحكم الشرعي، وتحكم في كل نوع تنبيه.",
};

export default function WhatsAppPage() {
  return <WhatsAppClient />;
}
