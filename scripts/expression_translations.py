"""Apply authored phrase glosses only to the exact reviewed phrase/sense pair."""
import json
from pathlib import Path


DEFAULT_PATH = Path(__file__).resolve().parent.parent / 'data/expression-translations.json'


def load_expression_translations(path=DEFAULT_PATH):
    return json.loads(Path(path).read_text('utf-8'))


def validate_expression_translations(content, glosses, *, require_applied=False):
    if not isinstance(content, dict) or not isinstance(glosses, dict):
        raise ValueError('Expression translations and content must be entry maps')
    if set(glosses) != set(content):
        missing = sorted(set(content) - set(glosses))
        extra = sorted(set(glosses) - set(content))
        raise ValueError(f'Expression translation coverage mismatch: missing={missing[:5]}, extra={extra[:5]}')
    for entry_id, gloss in glosses.items():
        card = content[entry_id]
        if not isinstance(gloss, dict) or not isinstance(card, dict):
            raise ValueError(f'Invalid expression translation entry: {entry_id}')
        for field in ('meaning', 'expression'):
            if (not isinstance(gloss.get(field), str) or not isinstance(card.get(field), str)
                    or gloss[field].strip() != card[field].strip()):
                raise ValueError(f'Expression translation {field} mismatch: {entry_id}')
        translation = gloss.get('expressionTranslation')
        if not isinstance(translation, str) or not translation.strip() or len(translation) > 2000:
            raise ValueError(f'Invalid expression translation: {entry_id}')
        if require_applied and card.get('expressionTranslation') != translation:
            raise ValueError(f'Expression translation not applied to content: {entry_id}')


def apply_expression_translations(content, glosses=None):
    if glosses is None:
        glosses = load_expression_translations()
    validate_expression_translations(content, glosses)
    # Validate the whole catalog before constructing any changes; never mutate callers.
    return {
        entry_id: {**card, 'expressionTranslation': glosses[entry_id]['expressionTranslation']}
        for entry_id, card in content.items()
    }
