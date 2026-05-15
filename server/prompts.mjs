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

/** @param {'zh' | 'en'} lang */
export function careBundleUserPrompt(lang, context) {
  if (lang === 'zh') {
    return (
      `以下是使用者允許你使用的照護紀錄（僅文字與勾選狀態，沒有照片像素內容）。\n\n${context}\n\n` +
      `請輸出**僅一個 JSON 物件**（不要 markdown、不要程式碼區塊、不要註解），且**必須**同時包含下列三個鍵，鍵名逐字相同，值皆為**非空字串**：\n` +
      `"healthSummary", "sevenDayAnalysis", "vetReport"\n` +
      `（缺一不可；若某段暫無內容可寫，仍請輸出簡短說明字串，勿省略鍵或留空。）\n\n` +
      `結構範例（請依實際紀錄撰寫內文，勿照抄範例文字）：\n` +
      `{"healthSummary":"…","sevenDayAnalysis":"…","vetReport":"…"}\n\n` +
      `欄位說明：\n` +
      `- healthSummary：以「今日與近期紀錄」為主的照護觀察與提醒（3～10 行，繁體中文）。\n` +
      `- sevenDayAnalysis：最近 7 天趨勢與紀錄完整度（3～12 行）；若數天無紀錄請據實說明。\n` +
      `- vetReport：給獸醫參考的紀錄摘要（體重、飲食／喝水／排泄勾選、異常欄與備註、照片張數等；非診斷，3～12 行）。\n` +
      `禁止診斷、禁止醫療建議、禁止臆測未記載的症狀。`
    );
  }
  return (
    `Below are care records the user allows you to use (checkboxes and text only — no photo pixels).\n\n${context}\n\n` +
    `Return **only one JSON object** (no markdown, no code fences, no comments). It **must** include all three keys exactly as written, each a **non-empty string**:\n` +
    `"healthSummary", "sevenDayAnalysis", "vetReport"\n` +
    `(Do not omit a key or use null; if a section is thin, still write a short sentence.)\n\n` +
    `Shape example (replace text with real content from the logs — do not copy placeholder text):\n` +
    `{"healthSummary":"...","sevenDayAnalysis":"...","vetReport":"..."}\n\n` +
    `- healthSummary: care observations grounded in today/recent logs (3–10 lines, English).\n` +
    `- sevenDayAnalysis: last-7-day pattern and logging completeness (3–12 lines).\n` +
    `- vetReport: factual visit handoff from logs only (not a diagnosis; 3–12 lines).\n` +
    `No diagnosis, no medical advice, no invented symptoms.`
  );
}

/** @param {'zh' | 'en'} lang */
export function qaUserPrompt(lang, context, question) {
  if (lang === 'zh') {
    return `${context}\n\n使用者問題：\n${question.trim()}\n\n請用繁體中文簡短回答，只根據上面紀錄；禁止診斷、禁止醫療建議、禁止開藥或臆測未記載症狀。`;
  }
  return `${context}\n\nUser question:\n${question.trim()}\n\nAnswer briefly in English using only the records above; no diagnosis, no medical advice, no prescriptions, no invented symptoms.`;
}
