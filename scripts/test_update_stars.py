"""Tests for update_stars.render. Run: python scripts/test_update_stars.py"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_stars import render  # noqa: E402

HIDDEN = '<span class="stars" data-repo="a" hidden></span>'


class RenderTests(unittest.TestCase):
    def test_zero_stays_hidden(self):
        self.assertEqual(render(HIDDEN, {"a": 0}), HIDDEN)

    def test_one_is_shown_singular(self):
        out = render(HIDDEN, {"a": 1})
        self.assertIn("★ 1", out)
        self.assertIn("1 star on GitHub", out)
        self.assertNotIn("hidden", out)

    def test_many_plural(self):
        self.assertIn("5 stars on GitHub", render(HIDDEN, {"a": 5}))

    def test_drops_back_to_hidden(self):
        shown = render(HIDDEN, {"a": 2})
        self.assertEqual(render(shown, {"a": 0}), HIDDEN)

    def test_missing_repo_untouched(self):
        shown = render(HIDDEN, {"a": 2})
        self.assertEqual(render(shown, {"b": 9}), shown)

    def test_bad_values_untouched(self):
        shown = render(HIDDEN, {"a": 2})
        for bad in (-1, "3", None, True, 1.5):
            self.assertEqual(render(shown, {"a": bad}), shown)

    def test_idempotent(self):
        once = render(HIDDEN, {"a": 3})
        self.assertEqual(render(once, {"a": 3}), once)

    def test_other_html_untouched(self):
        page = "<p>x</p>" + HIDDEN + "<b>y</b>"
        self.assertEqual(render(page, {"a": 0}), page)


if __name__ == "__main__":
    unittest.main()
