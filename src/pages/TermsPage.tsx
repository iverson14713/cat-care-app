import { useEffect } from 'react';
import { LegalBulletList, LegalPageLayout, LegalSection } from './LegalPageLayout';

const CONTACT_EMAIL = 'iverson14713@gmail.com';

const copy = {
  zh: {
    title: 'Pet Care 服務條款',
    subtitle: '最後更新日期：2026-05',
    back: '返回 App',
    footer: '繼續使用本 App 即代表你同意本服務條款',
    s1: '服務說明',
    s1Body:
      'Pet Care 協助你記錄寵物照護、體重、獸醫相關資訊，並提供 AI 整理與雲端同步。本 App 不提供醫療診斷或治療建議。',
    s2: '使用規範',
    s2Intro: '使用本 App 時，請你：',
    s2Items: [
      '提供真實、合法的寵物與照護資訊',
      '妥善保管帳號與邀請碼，勿與未授權者分享',
      '尊重共同照護成員的隱私',
    ],
    s3: '免責聲明',
    s3Body:
      'AI 與報告內容僅供參考，不能取代獸醫專業判斷。若寵物出現異常，請儘快就醫。我們不對因使用本 App 所造成的間接損害負責。',
    s4: '方案與付款',
    s4Body:
      'Pro 方案之購買、續訂與退款，依各應用商店（如 App Store）之規範辦理。測試環境下的解鎖不代表正式收費已完成。',
    s5: '聯絡方式',
    s5Intro: '如有服務條款相關問題，歡迎來信：',
  },
  en: {
    title: 'Pet Care Terms of Service',
    subtitle: 'Last updated: May 2026',
    back: 'Back to app',
    footer: 'By continuing to use this app, you agree to these terms of service.',
    s1: 'About the service',
    s1Body:
      'Pet Care helps you log pet care, weight, and vet-related information, with AI summaries and cloud sync. This app does not provide medical diagnosis or treatment.',
    s2: 'Acceptable use',
    s2Intro: 'When using the app, please:',
    s2Items: [
      'Provide accurate, lawful pet and care information',
      'Keep your account and invite codes secure',
      'Respect shared-care members’ privacy',
    ],
    s3: 'Disclaimer',
    s3Body:
      'AI and reports are for reference only and do not replace a veterinarian. Seek professional care if your pet is unwell. We are not liable for indirect damages from use of the app.',
    s4: 'Plans & billing',
    s4Body:
      'Pro purchases, renewals, and refunds follow the rules of your app store (e.g. App Store). Test unlocks do not represent completed billing.',
    s5: 'Contact',
    s5Intro: 'Questions about these terms? Email us at:',
  },
} as const;

function detectLang(): keyof typeof copy {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function TermsPage() {
  const t = copy[detectLang()];

  useEffect(() => {
    document.title = t.title;
    return () => {
      document.title = 'Pet Care';
    };
  }, [t.title]);

  return (
    <LegalPageLayout title={t.title} subtitle={t.subtitle} backLabel={t.back} footerNote={t.footer}>
      <LegalSection index={1} title={t.s1}>
        <p>{t.s1Body}</p>
      </LegalSection>

      <LegalSection index={2} title={t.s2}>
        <p>{t.s2Intro}</p>
        <LegalBulletList items={[...t.s2Items]} />
      </LegalSection>

      <LegalSection index={3} title={t.s3}>
        <p>{t.s3Body}</p>
      </LegalSection>

      <LegalSection index={4} title={t.s4}>
        <p>{t.s4Body}</p>
      </LegalSection>

      <LegalSection index={5} title={t.s5}>
        <p>{t.s5Intro}</p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-2 inline-block font-semibold text-orange-600 underline decoration-orange-200 underline-offset-2"
        >
          {CONTACT_EMAIL}
        </a>
      </LegalSection>
    </LegalPageLayout>
  );
}
