const original = 'I will trip to Nami Island in the fall with my girlfriend.';
const correctedSentence = 'I will take a trip to Nami Island in the fall with my girlfriend.';
const structure = {
  status: 'available', translation: '나는 가을에 여자 친구와 남이섬으로 여행을 갈 거예요.',
  parts: [
    { text: 'I', role: 'S', explanation: '나를 가리키며, 여행을 가는 주체예요.' },
    { text: 'will take', role: 'V', explanation: '앞으로 할 일을 나타내는 will과 동사 take예요.' },
    { text: 'a trip to Nami Island', role: 'O', explanation: '남이섬 여행이라는 목적어예요. to Nami Island는 trip의 목적지를 설명해요.' },
    { text: 'in the fall', role: 'M', explanation: '가을에: 여행을 갈 시간을 더해요.' },
    { text: 'with my girlfriend.', role: 'M', explanation: '여자 친구와 함께: 동행하는 사람을 더해요.' },
  ], note: 'S+V+O에 시간과 동행 정보를 더한 문장이에요. take a trip은 여행을 가다는 뜻이에요.',
};
const feedback = { original, correctedSentence, structure, meaningUsage: 'appropriate', grammar: 'needs_work', explanation: '여행을 가다는 take a trip으로 표현해요.', model: 'gemini-3.1-flash-lite', createdAt: '2026-09-29T00:00:00.000Z' };
module.exports = { original, correctedSentence, structure, feedback };
