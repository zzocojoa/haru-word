import type {LessonId} from './model';

// Authored curriculum criteria, never inferred from a learner's note or answer.
// Feature presence is evidence; this label evaluates correct use of that feature.
export const GRAMMAR_TARGET_CRITERIA:Record<LessonId,string>={
 noun:'Use a noun in a suitable nominal role and form. A noun can name a person, thing, place or idea; unrelated verb errors do not negate correct noun use.',
 verb:'Use a verb for an action or state with a suitable finite/nonfinite form, tense and subject agreement. State verbs are valid; an action-only verb is not required. If the verb-form error is known but a safe correction depends on a missing temporal interpretation, target needs_work may coexist with grammar uncertain and a time question.',
 pronoun:'Use pronouns in suitable roles and case forms, including subject and object forms. Case errors are target-use errors even when pronouns are present. Ordinary reference need not name a real person; accept natural it is me and context-supported short answers.',
 adjective:'Use an adjective to modify a noun or describe a subject through a linking verb. Do not treat a manner adjective used instead of a required adverb as correct adjective use.',
 adverb:'Use an adverb with a suitable form, role and position for manner, frequency, degree or another valid function. Not every adverb ends in -ly and not every -ly word is an adverb.',
 determiner:'Use a determiner suitably with its noun, including number, reference or quantity. Avoid incompatible combinations such as a possessive determiner plus an article.',
 'indefinite-article':'Use a/an with a suitable singular count noun and choose the article by the following sound. An article merely being present is insufficient.',
 'definite-article':'Use the when the intended referent can be identified from discourse or ordinary presumed shared context; do not demand a named real-world identifier when there is no contradictory evidence. Do not require the for every noun or generic plural.',
 number:'Use a cardinal or ordinal for its intended quantity or order, with a suitable associated noun form. Do not invent a counted item for an isolated ambiguous quantity.',
 preposition:'Use a preposition in a suitable relation and phrase, with suitable complements. Distinguish prepositional to from infinitival to.',
 conjunction:'Use a conjunction to connect suitable words, phrases or clauses and express a coherent relationship. For an unfinished message in default sentence-writing mode, withhold BOTH judgments as uncertain and ask for the intended linked propositions. This is different from a complete but demonstrably erroneous link, which needs target-use work. Explicit reason replies may license subordinate-clause ellipsis.',
 auxiliary:'Use an auxiliary construction with suitable auxiliary agreement and main-verb form, including licensed reply ellipsis. Lexical possession have is not an auxiliary just because the spelling is present. A recognizable construction with incorrect agreement still needs target-use work.',
 modal:'Use a modal with an appropriate base-form complement and intended meaning, including recoverable ellipsis in an explicit reply. A malformed past/participle form without enough time context requires withholding a chosen temporal correction and asking for time. Preserve modal strength; do not change possibility into obligation.',
 infinitive:'Use to plus the base verb in a suitable infinitival construction. A missing to marker or unsuitable following verb form needs target-use work.',
 exclamation:'Use a natural interjection or exclamatory expression suited to the expressed reaction. Valid standalone reactions do not require an invented subject or event.',
};
