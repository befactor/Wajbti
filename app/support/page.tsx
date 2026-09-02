"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";

type Lang = "ar" | "en";

const CONTACT_EMAIL = "mohdaymanfathalla@gmail.com";

const content: Record<Lang, { title: string; intro: string; sections: { h: string; p: string[] }[] }> = {
  ar: {
    title: "الدعم والتواصل",
    intro: "عندك سؤال، مشكلة بالتطبيق، أو اقتراح؟ تواصل معنا مباشرة.",
    sections: [
      {
        h: "إيميل التواصل",
        p: [CONTACT_EMAIL, "بنرد عادةً خلال يوم إلى يومين عمل."],
      },
      {
        h: "أسئلة شائعة",
        p: [
          "التطبيق مش عم يحلل الوجبة صح؟ جرب صحّح النتيجة من زر \"صحّح لي\" بعد التحليل — هيك منقدر نحسّن الدقة بمرور الوقت.",
          "نسيت كلمة السر؟ راسلنا عالإيميل فوق وبنساعدك تسترجع حسابك.",
          "بدك تحذف حسابك وبياناتك بالكامل؟ راسلنا عالإيميل فوق وبننفذ الطلب خلال أيام قليلة.",
        ],
      },
    ],
  },
  en: {
    title: "Support",
    intro: "Have a question, a bug to report, or a suggestion? Reach out directly.",
    sections: [
      {
        h: "Contact email",
        p: [CONTACT_EMAIL, "We typically reply within 1-2 business days."],
      },
      {
        h: "Common questions",
        p: [
          "Meal analysis looks off? Use the \"Fix\" button after analyzing to correct it - this helps us improve accuracy over time.",
          "Forgot your password? Email us at the address above and we'll help you recover your account.",
          "Want your account and data deleted entirely? Email us at the address above and we'll process it within a few days.",
        ],
      },
    ],
  },
};

export default function SupportPage() {
  const [lang, setLang] = useLang();
  const c = content[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  return (
    <div dir={dir} className="container">
      <div className="top-nav">
        <Link href="/" className="lang-toggle-inline">
          {lang === "ar" ? "← رجوع" : "← Back"}
        </Link>
        <button className="lang-toggle-inline" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          {lang === "ar" ? "English" : "العربية"}
        </button>
      </div>

      <div className="brand">
        <div className="brand-mark" />
        <h1 className="title">{c.title}</h1>
      </div>
      <p className="tagline">{c.intro}</p>

      {c.sections.map((s, i) => (
        <div key={i} className="tip-card">
          <h3>{s.h}</h3>
          {s.p.map((line, j) => (
            <p key={j} style={{ marginTop: j > 0 ? 8 : 0 }}>
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
