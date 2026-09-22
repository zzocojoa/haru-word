export function ExpressionLine({ expression, translation }: { expression: string; translation?: string }) {
  if (!expression.trim()) return null;
  return <div className="expression-line">
    <span>함께 익힐 표현</span>
    <div className="expression-pair">
      <b lang="en">{expression}</b>
      <p lang="ko" className={translation?.trim() ? "expression-translation" : "expression-missing"}>
        {translation?.trim() || "아직 표현 해석이 없어요. 단어장에서 추가할 수 있어요."}
      </p>
    </div>
  </div>;
}
