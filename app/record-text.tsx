/** Keep the original text intact; only long read-only records need a disclosure. */
export function RecordText({ text, label, lang }: { text: string; label: string; lang?: string }) {
  if (text.length <= 240 && text.split('\n').length <= 4) return <span lang={lang} className="record-text">{text}</span>;
  return <details className="notes-details record-text"><summary>{label} 더 보기</summary><p lang={lang}>{text}</p></details>;
}
