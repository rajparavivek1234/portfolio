# Vivek Rajpara — portfolio

Live: https://rajparavivek1234.github.io/portfolio/

A single-page portfolio for a backend / payments engineer. All content lives in
`content/profile.json`; a small Python build script turns it into a static site.

- **Python** — `build.py` (standard library only) renders `templates/index.html`
  from the JSON, HTML-escapes every value, fails on any unfilled placeholder, and
  writes `dist/`.
- **three.js** — `static/scene.js` draws a payment orchestrator: a wireframe core,
  one node per processor, and request/response packets coloured by outcome.
  Each response that lands is printed in the hero's transaction log.
- **Glass UI** — translucent, blurred panels over the 3D scene (`static/style.css`).
  Respects `prefers-reduced-motion` and still works without WebGL.
- **Resume** — `build_resume.py` prints `resume/resume_classic.html` to PDF with headless Chrome: a public copy (no phone) at `static/Vivek_Rajpara_Resume.pdf` plus its preview image, and with `--private-out` a copy with the phone number that is never committed.
- **Deploy** — `deploy.sh` runs `build.py` and force-pushes `dist/` to the
  `gh-pages` branch, which GitHub Pages serves.

## Edit and preview

```bash
# change content/profile.json, then:
python3 build.py --serve   # http://localhost:8080
git commit -am "update content" && git push && ./deploy.sh
```
