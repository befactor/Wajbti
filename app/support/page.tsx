"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";

type Lang = "ar" | "en";

const CONTACT_EMAIL = "mohdaymanfathalla@gmail.com";

const content: Record<Lang, { title: string; intro: string; sections: { h: string; p: string[] }[] }> = {
  ar: {
    title: "الدعم والتواصل",
    intro: "هل لديك سؤال، مشكلة في التطبيق، أو اقتراح؟ تواصل معنا مباشرة.",
    sections: [
      {
        h: "البريد الإلكتروني للتواصل",
        p: [CONTACT_EMAIL, "نرد عادةً خلال يوم إلى يومي عمل."],
      },
      {
        h: "أسئلة شائعة",
        p: [
          "هل التطبيق لا يحلل الوجبة بدقة؟ استخدم زر \"تصحيح\" بعد التحليل لتصحيح النتيجة — يساعدنا ذلك على تحسين الدقة بمرور الوقت.",
          "هل نسيت كلمة المرور؟ راسلنا على البريد الإلكتروني أعلاه وسنساعدك على استعادة حسابك.",
          "هل تريد حذف حسابك وبياناتك بالكامل؟ تقدر تحذفه بنفسك مباشرة من داخل التطبيق: الملف الشخصي ← \"حذف الحساب\" بأسفل الصفحة. الحذف فوري ونهائي.",
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
          "Want your account and data deleted entirely? You can delete it yourself right in the app: Profile → \"Delete account\" at the bottom of the page. Deletion is immediate and permanent.",
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
