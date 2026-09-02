"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";

type Lang = "ar" | "en";

const CONTACT_EMAIL = "mohdaymanfathalla@gmail.com";

const content: Record<Lang, { title: string; updated: string; sections: { h: string; p: string[] }[] }> = {
  ar: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: أغسطس 2026",
    sections: [
      {
        h: "المعلومات التي نجمعها",
        p: [
          "بيانات الحساب: الاسم والبريد الإلكتروني (عبر تسجيل الدخول بواسطة Google أو البريد الإلكتروني/كلمة المرور).",
          "بيانات الملف الشخصي: العمر، الجنس، الطول، الوزن، مستوى النشاط، هدفك، وحالة الحمل/الرضاعة إن وُجدت — وهي بيانات صحية حساسة نستخدمها فقط لحساب احتياجك الغذائي.",
          "الوجبات: وصف نصي أو صوتي أو صورة للوجبة، ونتيجة التحليل (السعرات، الماكروز).",
          "سجلات الماء والوزن، ومحادثاتك مع أخصائي التغذية الذكي، وأي تفضيلات أو حساسيات غذائية تذكرها في المحادثة.",
        ],
      },
      {
        h: "كيفية التعامل مع صور الوجبات",
        p: [
          "عند تصوير وجبة، تُرسل الصورة مباشرة إلى خدمة الذكاء الاصطناعي (Anthropic Claude) للتحليل فقط، ولا نقوم بتخزينها في خوادمنا بعد ذلك — تُحفظ فقط نتيجة التحليل النصية (السعرات والماكروز) في حال إضافتها إلى يومياتك.",
        ],
      },
      {
        h: "الجهات التي تصل إلى بياناتك",
        p: [
          "لا نبيع بياناتك ولا نشاركها لأغراض تسويقية.",
          "نستخدم مزوّدي خدمات لتشغيل التطبيق: Anthropic (تحليل الوجبات والمحادثة بالذكاء الاصطناعي)، Google (تسجيل الدخول)، وSupabase (استضافة قاعدة البيانات) — تصل إليها هذه الجهات بالحد الأدنى اللازم لتشغيل الخدمة فقط.",
        ],
      },
      {
        h: "الاحتفاظ ببياناتك",
        p: [
          "نحتفظ ببياناتك طوال فترة نشاط حسابك. يمكنك طلب حذف حسابك وجميع بياناتك بالتواصل معنا عبر البريد الإلكتروني أدناه.",
        ],
      },
      {
        h: "إخلاء مسؤولية صحي",
        p: [
          "وجبتي ليست بديلاً عن استشارة طبيب أو أخصائي تغذية مرخّص. التقديرات الغذائية والنصائح للإرشاد العام فقط، وأي حالة صحية حساسة (حمل، سكري، أمراض مزمنة) يجب مراجعة مختص بشأنها.",
        ],
      },
      {
        h: "الأطفال",
        p: ["التطبيق غير موجّه للأطفال دون سن 16 عاماً، ولا نجمع بيانات عنهم عن قصد."],
      },
      {
        h: "تواصل معنا",
        p: [`لأي سؤال عن خصوصيتك أو طلب حذف بياناتك: ${CONTACT_EMAIL}`],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: August 2026",
    sections: [
      {
        h: "What we collect",
        p: [
          "Account data: name and email (via Google sign-in or email/password).",
          "Profile data: age, sex, height, weight, activity level, your goal, and pregnancy/breastfeeding status if provided — sensitive health data used only to calculate your nutritional needs.",
          "Meals: a text/voice description or photo of a meal, and the analysis result (calories, macros).",
          "Water and weight logs, your conversations with the AI nutritionist, and any food preferences or allergies you mention in chat.",
        ],
      },
      {
        h: "How we handle meal photos",
        p: [
          "When you photograph a meal, the photo is sent directly to our AI provider (Anthropic Claude) for analysis only, and is not stored on our servers afterward - only the resulting text analysis (calories, macros) is saved if you add it to your diary.",
        ],
      },
      {
        h: "Who has access to your data",
        p: [
          "We do not sell your data or share it for marketing purposes.",
          "We use service providers to run the app: Anthropic (AI meal analysis and chat), Google (sign-in), and Supabase (database hosting) - each receives only the minimum needed to operate the service.",
        ],
      },
      {
        h: "Data retention",
        p: ["We retain your data while your account is active. You can request deletion of your account and all associated data by contacting us at the email below."],
      },
      {
        h: "Health disclaimer",
        p: [
          "Wajbti is not a substitute for advice from a physician or licensed dietitian. Nutritional estimates and tips are general guidance only; consult a specialist for any sensitive health condition (pregnancy, diabetes, chronic illness).",
        ],
      },
      {
        h: "Children",
        p: ["This app is not directed at children under 16, and we do not knowingly collect data from them."],
      },
      {
        h: "Contact us",
        p: [`For any privacy question or data deletion request: ${CONTACT_EMAIL}`],
      },
    ],
  },
};

export default function PrivacyPage() {
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
      <p className="tagline">{c.updated}</p>

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
