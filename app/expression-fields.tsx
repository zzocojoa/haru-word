"use client";

type ExpressionFieldsProps = {
  expression: string;
  expressionTranslation: string;
  onExpressionChange: (value: string) => void;
  onTranslationChange: (value: string) => void;
  help: string;
};

export function ExpressionFields({
  expression, expressionTranslation, onExpressionChange, onTranslationChange, help,
}: ExpressionFieldsProps) {
  return (
    <>
      <label>
        함께 익힐 표현
        <input maxLength={2000} value={expression}
          onChange={event => onExpressionChange(event.target.value)} />
      </label>
      <label>
        표현의 한국어 뜻
        <input maxLength={2000} value={expressionTranslation}
          onChange={event => onTranslationChange(event.target.value)}
          placeholder="영어 표현에 맞는 짧은 해석" />
      </label>
      <p className="small-note">{help}</p>
    </>
  );
}
