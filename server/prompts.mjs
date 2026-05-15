/** @param {'zh' | 'en'} lang */
export function systemBase(lang) {
  if (lang === 'zh') {
    return [
      '你是「貓咪照護日記」App 內的照護紀錄助理，只能依使用者提供的結構化紀錄撰寫：照護觀察、趨勢整理、生活面向提醒、以及「給獸醫參考的紀錄摘要」（方便就診時溝通）。',
      '嚴格禁止：任何疾病診斷、病因推測、醫療建議（包含是否用藥／劑量／要做哪些檢查／是否需急診等）、斷言健康正常或異常、開藥或取代獸醫。',
      '若紀錄不足以支持某項觀察，請直接說明資料不足，並鼓勵持續記錄或諮詢獸醫；不可臆測未出現在紀錄裡的狀況。',
      '語氣簡短、清楚、溫和。不要輸出任何法律聲明；App 會在內容後自動附加固定之中英文雙語聲明。',
    ].join('\n');
  }
  return [
    'You are a care-journal assistant in a cat diary app. Write only from the structured records: care observations, trend summaries, gentle routine reminders, and a factual “visit handoff summary” for a veterinarian (what was logged — not a medical report).',
    'Strictly forbidden: diagnosis, causes, any medical advice (meds/doses/tests/ER guidance), claiming health is normal/abnormal, prescriptions, or replacing a veterinarian.',
    'If records are insufficient, say so; do not invent facts. Do not output any legal disclaimer — the app appends a fixed bilingual (Chinese + English) disclaimer after your text.',
  ].join('\n');
}

/** Quick snapshot — today + last few days; NOT a full weekly report. */
export function careBundleUserPrompt(lang, context) {
  if (lang === 'zh') {
    return (
      `以下是「快速照護摘要」用的紀錄（僅文字與勾選；無照片像素）。**不要**寫完整週報或獸醫報告。\n\n${context}\n\n` +
      `請輸出**僅一個 JSON 物件**（不要 markdown），必含兩個鍵（皆為非空字串）：\n` +
      `"quickSummary", "careReminders"\n\n` +
      `欄位說明：\n` +
      `- quickSummary：今日＋最近幾天（約 3～7 天）的**極短**照護快覽（繁體中文，**最多 4 行**；每行一句）。\n` +
      `- careReminders：**僅 1～3 點**照護提醒（條列，用 \\n 分隔；每點一行；非診斷、不開藥）。\n` +
      `禁止：完整週報、長篇趨勢分析、獸醫就診摘要、診斷、醫療建議、臆測未記載症狀。`
    );
  }
  return (
    `Records for a **quick care snapshot** only (checkboxes/text — no photo pixels). **Do not** write a full weekly report or vet handoff.\n\n${context}\n\n` +
    `Return **only one JSON object** (no markdown) with two non-empty string keys:\n` +
    `"quickSummary", "careReminders"\n\n` +
    `- quickSummary: very short glance at today + recent ~3–7 days (**max 4 lines**, one sentence each, English).\n` +
    `- careReminders: **only 1–3** gentle care reminders (bullet lines separated by \\n; not diagnosis or meds).\n` +
    `Forbidden: full weekly report, long trend essays, vet visit summary, diagnosis, medical advice, invented symptoms.`
  );
}

/** @param {'zh' | 'en'} lang */
export function qaUserPrompt(lang, context, question) {
  if (lang === 'zh') {
    return `${context}\n\n使用者問題：\n${question.trim()}\n\n請用繁體中文簡短回答，只根據上面紀錄；禁止診斷、禁止醫療建議、禁止開藥或臆測未記載症狀。`;
  }
  return `${context}\n\nUser question:\n${question.trim()}\n\nAnswer briefly in English using only the records above; no diagnosis, no medical advice, no prescriptions, no invented symptoms.`;
}

/** Pro formal weekly report — full structure; shares main daily AI quota with care-bundle / qa. */
export function weeklyReportUserPrompt(lang, context) {
  if (lang === 'zh') {
    return (
      `${context}\n\n` +
      `請撰寫**正式照護週報**（比「快速摘要」完整得多）。輸出**僅一個 JSON 物件**（不要 markdown），必含下列鍵（皆為非空字串）：\n` +
      `"weekSummary", "completionRate", "trends", "abnormalTimeline", "weightChange", "vsLastWeek", "nextWeekFocus"\n\n` +
      `欄位說明：\n` +
      `- weekSummary：本週總覽（飲食、飲水、排泄、備註與照片摘要；5～10 行）\n` +
      `- completionRate：照護完成度（依勾選與紀錄天數估算感覺；條列 3～6 點）\n` +
      `- trends：本週趨勢（飲食／飲水／排泄等；條列 4～8 點）\n` +
      `- abnormalTimeline：異常時間線（有異常備註或照片的日期與摘要；若無請說明）\n` +
      `- weightChange：體重變化（依紀錄描述；若無資料請說明）\n` +
      `- vsLastWeek：與上週比較（對照「上週」區塊；若上週資料少請說明）\n` +
      `- nextWeekFocus：下週照護與紀錄重點（3～6 點）\n` +
      `嚴禁診斷、開藥、醫療結論、檢查處方、急診建議。`
    );
  }
  return (
    `${context}\n\n` +
    `Write a **formal weekly care report** (much fuller than a quick snapshot). Return **only one JSON object** (no markdown) with these non-empty string keys:\n` +
    `"weekSummary", "completionRate", "trends", "abnormalTimeline", "weightChange", "vsLastWeek", "nextWeekFocus"\n\n` +
    `- weekSummary: week overview (food, water, litter, notes/photos; 5–10 lines)\n` +
    `- completionRate: logging completion feel (3–6 bullet points)\n` +
    `- trends: this week's trends (4–8 bullets)\n` +
    `- abnormalTimeline: abnormal notes/photos by date (or state none)\n` +
    `- weightChange: weight trend from logs (or note missing data)\n` +
    `- vsLastWeek: compare to previous week block (or note sparse data)\n` +
    `- nextWeekFocus: care & logging priorities next week (3–6 bullets)\n` +
    `No diagnosis, prescriptions, medical conclusions, or invented symptoms.`
  );
}

/** Advanced vet handoff report — separate from care-bundle quota on server. */
export function vetReportUserPrompt(lang, context) {
  if (lang === 'zh') {
    return (
      `${context}\n\n` +
      `請依上述照護紀錄，輸出**僅一個 JSON 物件**（不要 markdown），必含三個鍵（皆為非空字串）：\n` +
      `"watchItems", "observeDirections", "vetHandoff"\n\n` +
      `欄位說明：\n` +
      `- watchItems：最近需注意事項（條列式，繁體中文，3～8 點）\n` +
      `- observeDirections：建議在家觀察方向（非醫療處置，3～6 點）\n` +
      `- vetHandoff：建議帶給獸醫溝通的重點（紀錄摘要式，3～8 點）\n` +
      `嚴禁診斷、病因斷言、開藥、檢查處方、急診建議。僅整理紀錄與觀察。`
    );
  }
  return (
    `${context}\n\n` +
    `From the records above, return **only one JSON object** (no markdown) with three non-empty string keys:\n` +
    `"watchItems", "observeDirections", "vetHandoff"\n\n` +
    `- watchItems: what to watch lately (bullet-style, 3–8 items)\n` +
    `- observeDirections: home observation ideas only — not medical orders (3–6 items)\n` +
    `- vetHandoff: factual points to tell the vet from logs (3–8 items)\n` +
    `No diagnosis, no prescriptions, no medical advice.`
  );
}
