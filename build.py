#!/usr/bin/env python3
"""
build.py

Static site generator for the portfolio. Reads content/profile.json, renders
templates/index.html, and writes the finished site to dist/ together with the
files in static/. Standard library only.

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


def e(text: object) -> str:
    """HTML-escape every piece of content before it lands in the page."""
    return html.escape(str(text), quote=True)


def chips(items: list[str], cls: str = "chip") -> str:
    return "".join(f'<li class="{cls}">{e(i)}</li>' for i in items)


def render_stats(stats: list[dict]) -> str:
    return "\n".join(
        f"""<div class="stat glass reveal">
  <div class="stat-value"><span class="count" data-target="{int(s['value'])}">{int(s['value'])}</span>{e(s['suffix'])}</div>
  <div class="stat-label">{e(s['label'])}</div>
  <div class="stat-detail">{e(s['detail'])}</div>
</div>"""
        for s in stats
    )


def render_pipeline(stages: list[dict]) -> str:
    out = []
    for n, s in enumerate(stages, start=1):
        gate = " stage-gate" if s.get("gate") else ""
        out.append(
            f"""<li class="stage{gate}" data-stage="{e(s['id'])}">
  <span class="stage-n mono">{n:02d}</span>
  <span class="stage-label">{e(s['label'])}</span>
  <span class="stage-sub mono">{e(s['sub'])}</span>
</li>"""
        )
    return "\n".join(out)


def render_ai_systems(systems: list[dict]) -> str:
    out = []
    for s in systems:
        metric = f'<p class="ai-metric mono">{e(s["metric"])}</p>' if s.get("metric") else ""
        out.append(
            f"""<article class="ai-card glass reveal">
  <span class="kicker mono">{e(s['kicker'])}</span>
  <h3>{e(s['title'])}</h3>
  <p>{e(s['text'])}</p>
  <ul class="chips">{chips(s['tags'], 'chip chip-sm')}</ul>
  {metric}
</article>"""
        )
    return "\n".join(out)


TROPHY = (
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/>'
    '<path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>'
)


def render_hackathon(h: dict) -> str:
    pillars = "".join(
        f'<div class="pillar"><span class="pillar-n mono">{i:02d}</span><h4>{e(p["title"])}</h4><p>{e(p["text"])}</p></div>'
        for i, p in enumerate(h["pillars"], start=1)
    )
    numbers = "".join(
        f'<div class="h-num"><span class="h-val">{e(n["value"])}</span><span class="h-lab mono">{e(n["label"])}</span></div>'
        for n in h["numbers"]
    )
    states = "".join(f'<li class="mono">{e(s)}</li>' for s in h["states"])
    return f"""<article class="hackathon glass reveal" id="hackathon">
  <div class="h-top">
    <div class="h-head">
      <span class="h-badge mono">{TROPHY}{e(h['badge'])}</span>
      <h3 class="h-title">{e(h['name'])}</h3>
      <p class="h-pitch">{e(h['pitch'])}</p>
      <p class="h-problem">{e(h['problem'])}</p>
      <p class="h-reward mono">★ {e(h['reward'])}</p>
    </div>
    <div class="sim" id="sim" aria-label="Monte Carlo delivery-date simulation">
      <div class="sim-head">
        <span class="mono">eta_engine · 2,000 simulations</span>
        <button class="replay mono" type="button" id="sim-run">↻ re-run</button>
      </div>
      <svg class="sim-chart" id="sim-chart" viewBox="0 0 320 150" preserveAspectRatio="none" role="img" aria-label="Histogram of simulated delivery times"></svg>
      <div class="sim-ps">
        <div><span class="mono">P50 · likely</span><b id="p50">–</b></div>
        <div><span class="mono">P80 · safe</span><b id="p80">–</b></div>
        <div><span class="mono">P95 · worst case</span><b id="p95">–</b></div>
      </div>
      <p class="sim-note mono">Runs in your browser: four dependent tasks with PERT effort estimates (illustrative inputs)</p>
    </div>
  </div>
  <div class="pillars">{pillars}</div>
  <div class="h-numbers">{numbers}</div>
  <div class="h-bottom">
    <div>
      <span class="kicker mono">how we knew it was good</span>
      <ul class="chips">{chips(h['evals'], 'chip chip-sm')}</ul>
      <p class="h-built">{e(h['built'])}</p>
    </div>
    <div>
      <span class="kicker mono">plan lifecycle</span>
      <ol class="states">{states}</ol>
      <p class="h-impact">{e(h['impact'])}</p>
    </div>
  </div>
</article>"""


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


def render_featured(f: dict) -> str:
    stats = "".join(
        f'<div class="f-stat"><span class="f-val">{e(s["value"])}</span><span class="f-lab mono">{e(s["label"])}</span></div>'
        for s in f["stats"]
    )
    return f"""<article class="featured glass reveal">
  <div class="featured-main">
    <span class="kicker mono">{e(f['kicker'])}</span>
    <h3><span class="grad">{e(f['name'])}</span> — {e(f['title'])}</h3>
    <p>{e(f['text'])}</p>
    <p class="featured-point">{e(f['point'])}</p>
    <ul class="chips">{chips(f['tags'], 'chip chip-sm')}</ul>
  </div>
  <div class="featured-stats">{stats}</div>
</article>"""


def render_skills(groups: list[dict]) -> str:
    return "\n".join(
        f"""<div class="skill-group glass reveal">
  <h3 class="mono">{e(g['group'])}</h3>
  <ul class="chips">{chips(g['items'])}</ul>
</div>"""
        for g in groups
    )


def render_processors(names: list[str]) -> str:
    c = chips(names, "chip chip-ghost")
    # Rendered twice so the CSS marquee loops without a gap; the copy is hidden from screen readers.
    return f'<ul class="marquee-track">{c}</ul><ul class="marquee-track" aria-hidden="true">{c}</ul>'


def render_projects(projects: list[dict]) -> str:
    out = []
    for p in projects:
        link = (
            f'<a class="project-link mono" href="{e(p["url"])}" target="_blank" rel="noopener">view on GitHub ↗</a>'
            if p.get("url")
            else '<span class="project-link mono muted">private repository</span>'
        )
        out.append(
            f"""<article class="project glass reveal">
  <h3>{e(p['name'])}</h3>
  <p>{e(p['text'])}</p>
  <ul class="chips">{chips(p['tags'], 'chip chip-sm')}</ul>
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
        "SUBROLE": e(profile["subrole"]),
        "ROTATING_JSON": e(json.dumps(profile["rotating"])),
        "ROTATING_FIRST": e(profile["rotating"][0]),
        "TAGLINE": e(profile["tagline"]),
        "LOCATION": e(profile["location"]),
        "NOW": e(profile["now"]),
        "HERO_BADGE": e(profile["hero_badge"]),
        "EMAIL": e(profile["email"]),
        "LINKEDIN": e(profile["linkedin"]),
        "GITHUB": e(profile["github"]),
        "SITE_URL": e(profile["site_url"]),
        "SUMMARY": "\n".join(f"<p>{e(p)}</p>" for p in profile["summary"]),
        "STATS": render_stats(profile["stats"]),
        "PIPELINE": render_pipeline(profile["pipeline"]),
        "AGENT_RUN_JSON": e(json.dumps(profile["agent_run"])),
        "AI_SYSTEMS": render_ai_systems(profile["ai_systems"]),
        "HACKATHON": render_hackathon(profile["hackathon"]),
        "EXPERIENCE": render_experience(profile["experience"]),
        "CASES": render_cases(profile["cases"]),
        "FEATURED": render_featured(profile["featured"]),
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
        "RESUME_UPDATED": date.today().strftime("%b %Y"),
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
    page = render(profile)
    # Cache-bust the assets so returning visitors get the new CSS/JS straight away.
    import hashlib
    for asset in ("style.css", "scene.js", "app.js"):
        digest = hashlib.sha1((STATIC / asset).read_bytes()).hexdigest()[:8]
        page = page.replace(f'"{asset}"', f'"{asset}?v={digest}"')
    (DIST / "index.html").write_text(page, encoding="utf-8")
    (DIST / ".nojekyll").write_text("", encoding="utf-8")
    print(f"built {DIST / 'index.html'} ({sum(1 for p in DIST.rglob('*') if p.is_file())} files)")


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
