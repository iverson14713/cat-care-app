import { useEffect } from 'react';
import { LegalBulletList, LegalPageLayout, LegalSection } from './LegalPageLayout';

const CONTACT_EMAIL = 'iverson14713@gmail.com';

const copy = {
  zh: {
    title: 'Pet Care 隱私政策',
    subtitle: '最後更新日期：2026-05',
    back: '返回 App',
    footer: '繼續使用本 App 即代表你同意本隱私政策',
    s1: '我們收集哪些資料',
    s1Items: ['帳號資料（Email）', '寵物資料', '照護紀錄', '體重紀錄', '照片', 'AI 使用次數'],
    s2: '資料用途',
    s2Intro: '用於：',
    s2Items: ['雲端同步', 'AI 功能', '多裝置同步', '共同照護'],
    s3: '照片與健康資料',
    s3Body: '照片與健康紀錄僅提供使用者本人，以及被授權的共同照護者查看。',
    s4: '雲端服務',
    s4Intro: '本 App 使用以下服務提供同步與 AI 功能：',
    s4Items: ['Supabase', 'OpenAI API'],
    s5: '資料安全',
    s5Body: '所有資料皆透過加密連線傳輸。',
    s6: '刪除資料',
    s6Intro: '使用者可以：',
    s6Items: ['封存寵物', '永久刪除資料', '匯出備份'],
    s7: '聯絡方式',
    s7Intro: '如有隱私相關問題，歡迎來信：',
  },
  en: {
    title: 'Pet Care Privacy Policy',
    subtitle: 'Last updated: May 2026',
    back: 'Back to app',
    footer: 'By continuing to use this app, you agree to this privacy policy.',
    s1: 'What we collect',
    s1Items: [
      'Account info (email)',
      'Pet profiles',
      'Care logs',
      'Weight records',
      'Photos',
      'AI usage counts',
    ],
    s2: 'How we use data',
    s2Intro: 'We use your data for:',
    s2Items: ['Cloud sync', 'AI features', 'Multi-device sync', 'Shared care'],
    s3: 'Photos & health data',
    s3Body:
      'Photos and health records are visible only to you and caregivers you explicitly authorize.',
    s4: 'Cloud services',
    s4Intro: 'This app uses the following services for sync and AI:',
    s4Items: ['Supabase', 'OpenAI API'],
    s5: 'Security',
    s5Body: 'All data is transmitted over encrypted connections.',
    s6: 'Deleting data',
    s6Intro: 'You can:',
    s6Items: ['Archive a pet', 'Permanently delete data', 'Export a backup'],
    s7: 'Contact',
    s7Intro: 'Questions about privacy? Email us at:',
  },
} as const;

function detectLang(): keyof typeof copy {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function PrivacyPolicyPage() {
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
        <LegalBulletList items={[...t.s1Items]} />
      </LegalSection>

      <LegalSection index={2} title={t.s2}>
        <p>{t.s2Intro}</p>
        <LegalBulletList items={[...t.s2Items]} />
      </LegalSection>

      <LegalSection index={3} title={t.s3}>
        <p>{t.s3Body}</p>
      </LegalSection>

      <LegalSection index={4} title={t.s4}>
        <p>{t.s4Intro}</p>
        <LegalBulletList items={[...t.s4Items]} />
      </LegalSection>

      <LegalSection index={5} title={t.s5}>
        <p>{t.s5Body}</p>
      </LegalSection>

      <LegalSection index={6} title={t.s6}>
        <p>{t.s6Intro}</p>
        <LegalBulletList items={[...t.s6Items]} />
      </LegalSection>

      <LegalSection index={7} title={t.s7}>
        <p>{t.s7Intro}</p>
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
