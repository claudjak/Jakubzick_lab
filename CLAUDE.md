# Jakubzick Lab website — notes for Claude Code

Static GitHub Pages site for the Jakubzick Laboratory (Claudia Jakubzick, Microbiology and Immunology, Geisel School of
Medicine at Dartmouth), built September 2026 by duplicating the CANlab site (github.com/torwager/canlab; read its
`site_plan_claude.txt` for the shared design system, data schemas and pipeline). This file records what differs here.

## Decisions (from the site owner)
- Simpler than CANlab: no tools/training page, no reading lists or sign-in (app.js `starBtn` returns "", mylist/account
  pages and the worker were removed), no Google-form monitor. Nav: Research · People · Publications · News · Explore ▾
  (network, bibliometrics, about) · Join us.
- Join page is static: "Prof. Jakubzick is recruiting postdoctoral researchers and PhD students; contact her", plus the
  contact address from the old site and the lab's DEI statement.
- Interactive graphics must be immunology-themed: `site/assets/hero.js` draws macrophages, dendritic cells and monocytes;
  the cursor is a chemokine source, clicks release a burst and trigger phagocytosis. Colour rule as in CANlab: cells grey
  at rest, yellow→orange when activated. Brand accent is Dartmouth green (`--accent*` in app.css); amber is only the glow.
- Papers: only papers with Claudia Jakubzick as an author. Source = PubMed query `Jakubzick C[Author]` (90 records as of
  2026-09-09) merged with OpenAlex author A5036506329 for citations/OA links, plus two textbook chapters from the old site.
  Excluded: ImmGen consortium papers (listed statically at the bottom of publications.html) and an author correction.
  The 1999 carbonic-anhydrase PNAS paper (PMID 10611359) is included at the owner's request. OpenAlex-only
  items (conference abstracts, bioRxiv preprints of published papers) are not records.
- Content came from the old WordPress site geiselmed.dartmouth.edu/jakubzick (research text kept nearly verbatim, member
  bios, photos, DEI statement, contact) and Geisel/Guarini news pages. Xin Li graduated in 2025 (Strohbehn Medal) and is
  listed as an alumnus even though the old site still lists them as current.
- Gallery pictures are figure crops from the lab's CC BY papers (credits in `site/assets/gallery/credits.json`) plus the
  two figures and lab photo from the old site.

## Working
- `python3 -m pipeline.build_site`; preview with `python3 -m http.server 8765 --directory site`.
- Tags: `pipeline/taxonomy.json` (immunology vocabulary), first pass by Claude Code subagents from abstracts
  (`work/tagging/batch-NN.tags.json`, applied with `scripts/apply_tags.py`); the daily workflow tags new candidates.
- Bump `?v=` on app.css/app.js/layout.js/hero.js when they change.
