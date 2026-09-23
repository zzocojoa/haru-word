"""No network or tracked writes: pure merge checks and isolated export fixtures."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'scripts'))
from expression_translations import (  # noqa: E402
    apply_expression_translations, load_expression_translations, validate_expression_translations,
)


class ExpressionTranslationsTest(unittest.TestCase):
    def setUp(self):
        self.content = {
            'first': {'meaning': '도착하다', 'expression': 'arrive home', 'example': 'Keep me.'},
            'last': {'meaning': '바쁜', 'expression': 'be busy'},
        }
        self.glosses = {
            key: {**card, 'expressionTranslation': gloss}
            for (key, card), gloss in zip(self.content.items(), ['집에 도착하다', '바쁘다'])
        }

    def test_merge_is_immutable_idempotent_and_preserves_other_fields(self):
        original = copy.deepcopy(self.content)
        merged = apply_expression_translations(self.content, self.glosses)
        self.assertEqual(self.content, original)
        self.assertEqual(merged['first']['example'], 'Keep me.')
        self.assertEqual(merged['last']['expressionTranslation'], '바쁘다')
        self.assertIsNot(merged['first'], self.content['first'])
        self.assertEqual(apply_expression_translations(merged, self.glosses), merged)
        validate_expression_translations(merged, self.glosses, require_applied=True)

    def test_coverage_reports_missing_and_extra_ids(self):
        for kind in ['missing', 'extra']:
            glosses = copy.deepcopy(self.glosses)
            if kind == 'missing':
                del glosses['last']
            else:
                glosses['extra_id'] = glosses['last']
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, kind + '='):
                apply_expression_translations(self.content, glosses)

    def test_late_invalid_entry_never_partially_changes_input(self):
        original = copy.deepcopy(self.content)
        for field, value in [('meaning', '다른 뜻'), ('expression', 'different phrase'),
                             ('expressionTranslation', ''), ('expressionTranslation', '  '),
                             ('expressionTranslation', '가' * 2001), ('expressionTranslation', None),
                             ('meaning', 3)]:
            glosses = copy.deepcopy(self.glosses)
            glosses['last'][field] = value
            with self.subTest(field=field, value=str(value)[:20]), self.assertRaisesRegex(ValueError, 'last'):
                apply_expression_translations(self.content, glosses)
            self.assertEqual(self.content, original)

    def test_only_outer_whitespace_is_ignored_when_matching(self):
        self.glosses['first']['meaning'] = ' 도착하다 '
        self.glosses['first']['expression'] = ' arrive home '
        validate_expression_translations(self.content, self.glosses)
        self.glosses['first']['expression'] = 'Arrive home'
        with self.assertRaisesRegex(ValueError, 'expression mismatch: first'):
            validate_expression_translations(self.content, self.glosses)

    def test_export_validation_requires_the_exact_applied_gloss(self):
        for value in [None, '', '다른 해석']:
            content = apply_expression_translations(self.content, self.glosses)
            if value is None:
                del content['last']['expressionTranslation']
            else:
                content['last']['expressionTranslation'] = value
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, 'not applied.*last'):
                validate_expression_translations(content, self.glosses, require_applied=True)

    def test_loading_and_shape_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'glosses.json'
            path.write_text(json.dumps(self.glosses), encoding='utf-8')
            self.assertEqual(load_expression_translations(path), self.glosses)
        for invalid in [None, [], {'first': None, 'last': {}}]:
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                validate_expression_translations(self.content, invalid)

    def test_full_export_matches_shipped_data_and_failure_does_not_overwrite(self):
        content = json.loads((ROOT / 'data/content.json').read_text('utf-8'))
        glosses = load_expression_translations()
        self.assertEqual(len(content), 3809)
        self.assertEqual(apply_expression_translations(content, glosses), content)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for folder in ['data', 'work', 'public/sources']:
                (root / folder).mkdir(parents=True)
            for relative in ['data/words.json', 'data/source-audit.json']:
                (root / relative).write_bytes((ROOT / relative).read_bytes())
            (root / 'work/dictionary-credits.md').write_bytes((ROOT / 'public/sources/dictionary-credits.md').read_bytes())
            path = root / 'data/content.json'
            path.write_text(json.dumps(content, ensure_ascii=False), encoding='utf-8')
            command = [sys.executable, str(ROOT / 'scripts/prepare-attribution.py')]
            result = subprocess.run(command, cwd=root, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            published = root / 'public/sources/learning-data.json'
            expected = (ROOT / 'public/sources/learning-data.json').read_bytes()
            self.assertEqual(published.read_bytes(), expected)
            before = {p.name: p.read_bytes() for p in published.parent.iterdir()}
            last_id = next(reversed(content))
            del content[last_id]['expressionTranslation']
            path.write_text(json.dumps(content, ensure_ascii=False), encoding='utf-8')
            result = subprocess.run(command, cwd=root, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(last_id, result.stderr)
            self.assertEqual({p.name: p.read_bytes() for p in published.parent.iterdir()}, before)


if __name__ == '__main__':
    unittest.main()
