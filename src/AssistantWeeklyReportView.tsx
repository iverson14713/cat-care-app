import type { RefObject } from 'react';
import type { AssistantWeeklyReportJson } from './aiCareAssistant';
import { normalizeWeeklyReport, weeklySectionText, type Lang } from './weeklyReportModel';

type SectionDef = { key: keyof AssistantWeeklyReportJson; title: string };

type Props = {
  report: AssistantWeeklyReportJson;
  lang: Lang;
  reportRef?: RefObject<HTMLDivElement | null>;
  disclaimer: string;
  emptySectionLabel: string;
  sections: SectionDef[];
  renderBlock: (title: string, body: string) => React.ReactNode;
};

function SectionBody({
  body,
  emptyLabel,
  renderBlock,
  title,
}: {
  title: string;
  body: string;
  emptyLabel: string;
  renderBlock: (title: string, body: string) => React.ReactNode;
}) {
  const text = body.trim();
  if (!text) {
    return (
      <section className="mb-4 rounded-2xl border border-stone-100 border-l-4 border-l-stone-200 bg-white px-4 py-3.5 shadow-sm">
        <h3 className="mb-1.5 text-sm font-semibold text-stone-900">{title}</h3>
        <p className="text-[13px] leading-relaxed text-stone-500">{emptyLabel}</p>
      </section>
    );
  }
  return <>{renderBlock(title, text)}</>;
}

export function AssistantWeeklyReportView({
  report: rawReport,
  lang,
  reportRef,
  disclaimer,
  emptySectionLabel,
  sections,
  renderBlock,
}: Props) {
  const report = normalizeWeeklyReport(rawReport, lang);

  return (
    <div
      ref={reportRef}
      id="weekly-ai-report-print"
      className="space-y-3 rounded-2xl border border-violet-100 bg-white/90 p-3"
    >
      {sections.map(({ key, title }) => (
        <SectionBody
          key={key}
          title={title}
          body={weeklySectionText(report, key)}
          emptyLabel={emptySectionLabel}
          renderBlock={renderBlock}
        />
      ))}
      <p className="text-center text-[11px] leading-snug text-stone-400">{disclaimer}</p>
    </div>
  );
}
