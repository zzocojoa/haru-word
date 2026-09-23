// Domain-valid fixtures must cross the same validation boundary as real users.
function completedAssessment(words, level = 'A1') {
  const ids = words.filter(w => w.level === level && !w.personal).slice(0, 20).map(w => w.id);
  return { ids, index: ids.length, marks: Object.fromEntries(ids.map(id => [id, 'uncertain'])), completed: true };
}
module.exports = { completedAssessment };
