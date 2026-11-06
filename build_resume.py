#!/usr/bin/env python3
"""
build_resume.py

Renders resume/resume.html to PDF with headless Chrome, in two versions:
  - public  (no phone number) -> static/Vivek_Rajpara_Resume.pdf  (served by the site)
  - private (with phone)      -> path given by --private-out       (never committed)

Usage:
    python3 build_resume.py --private-out ~/Downloads/Vivek_Rajpara_Resume_26.pdf
"""

from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / "resume" / "resume.html"
PUBLIC_OUT = ROOT / "static" / "Vivek_Rajpara_Resume.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PHONE = ' · <a href="tel:+917016295028">+91 70162 95028</a>'


def render(html: str, out: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "resume.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run(
            [CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
             f"--print-to-pdf={out}", src.as_uri()],
            check=True, capture_output=True,
        )
    try:
        from pypdf import PdfReader
        pages = len(PdfReader(str(out)).pages)
    except ImportError:
        pages = "?"
    print(f"wrote {out} ({pages} pages, {out.stat().st_size // 1024} KB)")


def preview(pdf: Path) -> None:
    """Page-1 preview for the site, rendered from the public PDF with macOS Quick Look."""
    out = ROOT / "static" / "img" / "resume-preview.webp"
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["qlmanage", "-t", "-s", "1400", "-o", tmp, str(pdf)], check=True, capture_output=True)
        from PIL import Image
        im = Image.open(Path(tmp) / f"{pdf.name}.png").convert("RGB")
        im = im.resize((900, round(900 * im.height / im.width)), Image.LANCZOS)
        im.save(out, "WEBP", quality=86)
    print(f"wrote {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--private-out", type=Path, help="also write the version with the phone number here")
    args = parser.parse_args()
    html = TEMPLATE.read_text(encoding="utf-8")
    render(html.replace("{{PHONE}}", ""), PUBLIC_OUT)
    preview(PUBLIC_OUT)
    if args.private_out:
        render(html.replace("{{PHONE}}", PHONE), args.private_out.expanduser())


if __name__ == "__main__":
    main()
