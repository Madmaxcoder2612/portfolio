"""Write the GitHub star count of each project repo into index.html.

The page has one <span class="stars" data-repo="NAME" hidden></span> per card.
This script fills in "★ N" and removes `hidden` when N >= 1. At zero the span
stays empty and hidden, so no "0" is shown. The numbers are baked into the page,
so visitors' browsers contact nobody.

Usage:
    python scripts/update_stars.py '{"repo-name": 3, "other-repo": 0}'

Repos that are missing from the JSON are left exactly as they are, so a failed
lookup can never wipe a count. Prints "changed" or "unchanged".
"""

import json
import re
import sys
from pathlib import Path

PAGE = Path(__file__).resolve().parent.parent / "index.html"
SPAN = re.compile(r'<span class="stars" data-repo="([^"]+)"[^>]*>[^<]*</span>')


def render(html, counts):
    def one(match):
        repo = match.group(1)
        if repo not in counts:
            return match.group(0)
        n = counts[repo]
        if not isinstance(n, int) or isinstance(n, bool) or n < 0:
            return match.group(0)
        if n == 0:
            return f'<span class="stars" data-repo="{repo}" hidden></span>'
        word = "star" if n == 1 else "stars"
        return (f'<span class="stars" data-repo="{repo}" title="{n} {word} on GitHub">'
                f'★ {n}</span>')
    return SPAN.sub(one, html)


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2
    counts = json.loads(argv[1])
    html = PAGE.read_text(encoding="utf-8")
    new = render(html, counts)
    if new == html:
        print("unchanged")
        return 0
    PAGE.write_text(new, encoding="utf-8", newline="")
    print("changed")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
