// Old clients receive a terminal response without accessing AI, storage or EN_Card.
export function cardFeatureRetired(): Response {
  return Response.json({
    error: 'CARD_FEATURE_RETIRED',
    message: '영어 카드 서비스가 종료되었습니다. 하루단어 학습은 계속 이용할 수 있습니다.',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
