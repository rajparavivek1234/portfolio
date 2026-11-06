#!/usr/bin/env python3
"""
build.py

Static site generator for the portfolio. Reads content/profile.json, renders
templates/index.html, and writes the finished site to dist/ together with the
files in static/. Standard library only, so the GitHub Actions deploy needs no
pip install.

Usage:
    python3 build.py            # build into dist/
    python3 build.py --serve    # build, then serve dist/ on http://localhost:8080
"""

from __future__ import annotations

import argparse
import functools
import html
import http.server
import json
import shutil
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content" / "profile.json"
TEMPLATE = ROOT / "templates" / "index.html"
STATIC = ROOT / "static"
DIST = ROOT / "dist"


def e(text: str) -> str:
    """HTML-escape every piece of content before it lands in the page."""
    return html.escape(str(text), quote=True)


def render_stats(stats: list[dict]) -> str:
    return "\n".join(
        f"""<div class="stat glass reveal">
  <div class="stat-value"><span class="count" data-target="{int(s['value'])}">{int(s['value'])}</span>{e(s['suffix'])}</div>
  <div class="stat-label">{e(s['label'])}</div>
  <div class="stat-detail">{e(s['detail'])}</div>
</div>"""
        for s in stats
    )


def render_experience(jobs: list[dict]) -> str:
    out = []
    for i, job in enumerate(jobs):
        areas = "\n".join(
            f"""<article class="area glass reveal">
  <h4>{e(a['title'])}</h4>
  <p>{e(a['text'])}</p>
</article>"""
            for a in job["areas"]
        )
        out.append(
            f"""<div class="job" id="job-{i}">
  <div class="job-head reveal">
    <div class="job-dot" aria-hidden="true"></div>
    <div>
      <h3>{e(job['title'])} <span class="at">@ {e(job['company'])}</span></h3>
      <p class="job-meta mono">{e(job['period'])} · {e(job['place'])} · {e(job['context'])}</p>
      <p class="job-intro">{e(job['intro'])}</p>
    </div>
  </div>
  <div class="areas">
{areas}
  </div>
</div>"""
        )
    return "\n".join(out)


def render_cases(cases: list[dict]) -> str:
    out = []
    for n, c in enumerate(cases, start=1):
        out.append(
            f"""<article class="case glass reveal">
  <div class="case-id mono">INCIDENT #{n:02d}</div>
  <h3>{e(c['title'])}</h3>
  <dl>
    <div class="row sym"><dt class="mono">symptom</dt><dd>{e(c['symptom'])}</dd></div>
    <div class="row fix"><dt class="mono">fix</dt><dd>{e(c['fix'])}</dd></div>
    <div class="row proof"><dt class="mono">proof</dt><dd>{e(c['proof'])}</dd></div>
  </dl>
</article>"""
        )
    return "\n".join(out)


def render_skills(groups: list[dict]) -> str:
    out = []
    for g in groups:
        chips = "".join(f'<li class="chip">{e(item)}</li>' for item in g["items"])
        out.append(
            f"""<div class="skill-group glass reveal">
  <h3 class="mono">{e(g['group'])}</h3>
  <ul class="chips">{chips}</ul>
</div>"""
        )
    return "\n".join(out)


def render_processors(names: list[str]) -> str:
    chips = "".join(f'<li class="chip chip-ghost">{e(n)}</li>' for n in names)
    # Rendered twice so the CSS marquee can loop without a gap; the copy is hidden from screen readers.
    return f'<ul class="marquee-track">{chips}</ul><ul class="marquee-track" aria-hidden="true">{chips}</ul>'


def render_projects(projects: list[dict]) -> str:
    out = []
    for p in projects:
        tags = "".join(f'<li class="chip chip-sm">{e(t)}</li>' for t in p["tags"])
        link = (
            f'<a class="project-link mono" href="{e(p["url"])}" target="_blank" rel="noopener">view on GitHub ↗</a>'
            if p.get("url")
            else '<span class="project-link mono muted">private repository</span>'
        )
        out.append(
            f"""<article class="project glass reveal">
  <h3>{e(p['name'])}</h3>
  <p>{e(p['text'])}</p>
  <ul class="chips">{tags}</ul>
  {link}
</article>"""
        )
    return "\n".join(out)


def render(profile: dict) -> str:
    edu = profile["education"]
    replacements = {
        "NAME": e(profile["name"]),
        "SHORT_NAME": e(profile["short_name"]),
        "ROLE": e(profile["role"]),
        "TAGLINE": e(profile["tagline"]),
        "LOCATION": e(profile["location"]),
        "EMAIL": e(profile["email"]),
        "LINKEDIN": e(profile["linkedin"]),
        "GITHUB": e(profile["github"]),
        "SUMMARY": "\n".join(f"<p>{e(p)}</p>" for p in profile["summary"]),
        "STATS": render_stats(profile["stats"]),
        "EXPERIENCE": render_experience(profile["experience"]),
        "CASES": render_cases(profile["cases"]),
        "SKILLS": render_skills(profile["skills"]),
        "PROCESSORS": render_processors(profile["processors"]),
        "PROCESSORS_JSON": e(json.dumps(profile["processors"])),
        "PROJECTS": render_projects(profile["projects"]),
        "EDU_DEGREE": e(edu["degree"]),
        "EDU_SCHOOL": e(edu["school"]),
        "EDU_PERIOD": e(edu["period"]),
        "EDU_GRADE": e(edu["grade"]),
        "CERTS": "".join(f"<li>{e(c)}</li>" for c in profile["certifications"]),
        "YEAR": str(date.today().year),
    }
    page = TEMPLATE.read_text(encoding="utf-8")
    for key, value in replacements.items():
        page = page.replace("{{" + key + "}}", value)
    leftover = [part.split("}}")[0] for part in page.split("{{")[1:]]
    if leftover:
        raise SystemExit(f"unfilled placeholders in template: {leftover}")
    return page


def build() -> None:
    profile = json.loads(CONTENT.read_text(encoding="utf-8"))
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST)
    (DIST / "index.html").write_text(render(profile), encoding="utf-8")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")
    print(f"built {DIST / 'index.html'} ({len(list(DIST.rglob('*')))} files)")


def serve(port: int) -> None:
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"serving http://localhost:{port}")
        srv.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--serve", action="store_true", help="serve dist/ after building")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    build()
    if args.serve:
        serve(args.port)
