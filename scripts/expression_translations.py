"""Apply authored phrase glosses only to the exact reviewed phrase/sense pair."""
import json
from pathlib import Path


def apply_expression_translations(content):
    path = Path(__file__).resolve().parent.parent / 'data/expression-translations.json'
    glosses = json.loads(path.read_text('utf-8'))
    if set(glosses) != set(content):
        raise ValueError('Expression translation coverage does not match the catalog')
    for entry_id, gloss in glosses.items():
        card = content[entry_id]
        if any(gloss[field].strip() != card[field].strip() for field in ('meaning', 'expression')):
            raise ValueError(f'Review the expression translation after changing content: {entry_id}')
        translation = gloss['expressionTranslation']
        if not translation.strip() or len(translation) > 2000:
            raise ValueError(f'Invalid expression translation: {entry_id}')
        card['expressionTranslation'] = translation
    return content
