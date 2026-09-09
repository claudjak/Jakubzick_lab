"""One-off import (2026-09-09): build data/papers.json from PubMed records (parsed XML -> JSON) merged with OpenAlex works.

usage: python scripts/import_pubmed.py <pubmed_records.json> <openalex_works.json>
Kept for provenance; the daily pipeline maintains papers.json afterwards.
"""
import json, re, sys, difflib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
recs = json.load(open(sys.argv[1]))
oa = json.load(open(sys.argv[2])).get("results", [])
STOP = {"the", "and", "with", "from", "their", "that", "this", "into", "during", "using", "between", "across", "after", "versus", "against", "human", "mouse", "murine", "cells", "cell", "role", "roles", "novel"}
TODAY = "2026-09-09"


def norm(t):
    return re.sub(r"[^a-z0-9 ]", "", (t or "").lower()).strip()


def make_id(r):
    sur = norm(r["authors_short"][0].rsplit(" ", 1)[0]).replace(" ", "") if r["authors_short"] else "anon"
    words = [w for w in re.findall(r"[a-z]+", norm(r["title"])) if len(w) >= 5 and w not in STOP]
    return f"{sur}{r['year']}{words[0] if words else 'paper'}"


def nlm_citation(r):
    au = ", ".join(r["authors_short"][:6]) + (", et al" if len(r["authors_short"]) > 6 else "")
    vol = r.get("volume") or ""
    if r.get("issue"):
        vol += f"({r['issue']})"
    loc = ";".join(x for x in [vol] if x)
    pg = f":{r['pages']}" if r.get("pages") else ""
    s = f"{au}. {r['title'].rstrip('.')}. {r['journal']}. {r['year']}"
    if loc or pg:
        s += f";{loc}{pg}"
    s += "."
    if r.get("doi"):
        s += f" doi:{r['doi']}"
    return s


def abstract_from_inverted(idx):
    if not idx:
        return ""
    pos = {}
    for w, ps in idx.items():
        for p in ps:
            pos[p] = w
    return " ".join(pos[i] for i in sorted(pos))


oa_by_doi = {(w.get("doi") or "").lower().replace("https://doi.org/", ""): w for w in oa if w.get("doi")}
oa_by_title = {norm(w.get("title")): w for w in oa if w.get("title")}
PREPRINT_J = {"bioRxiv", "Res Sq", "medRxiv"}
papers, used_oa = [], set()
for r in recs:
    pt = set(r["ptypes"])
    if "Published Erratum" in pt:
        continue  # the correction is noted on the parent record below
    kind = "article"
    status = "published"
    if "Preprint" in pt or r["journal"] in PREPRINT_J:
        kind, status = "preprint", "preprint"
    elif r["journal"] == "Methods Mol Biol":
        kind = "chapter"
    typ = "empirical"
    if "Review" in pt:
        typ = "review"
    if pt & {"Comment", "Editorial", "Letter", "Introductory Journal Article"}:
        typ = "commentary"
    if kind == "chapter" or r["journal"] in ("J Vis Exp", "J Immunol Methods"):
        typ = "methods"
    w = oa_by_doi.get((r.get("doi") or "").lower()) or oa_by_title.get(norm(r["title"]))
    if w:
        used_oa.add(w["id"])
    links = []
    if r.get("doi"):
        links.append({"type": "publisher", "label": "Publisher", "url": "https://doi.org/" + r["doi"]})
    if r.get("pmcid"):
        links.append({"type": "fulltext", "label": "Free full text (PMC)", "url": f"https://pmc.ncbi.nlm.nih.gov/articles/{r['pmcid']}/"})
    date = r.get("date")
    if not date:
        months = {m: i + 1 for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}
        date = f"{r['year']}-{months.get(r.get('month'), 1):02d}-01"
    rec = {
        "id": make_id(r), "title": r["title"].rstrip("."), "authors": r["authors"], "authors_short": r["authors_short"], "authors_truncated": False,
        "year": r["year"], "date": date, "status": status, "kind": kind, "journal": r["journal"], "journal_full": r.get("journal_full"),
        "volume": r.get("volume"), "issue": r.get("issue"), "pages": r.get("pages"), "doi": r.get("doi"), "pmid": r["pmid"], "pmcid": r.get("pmcid"),
        "openalex_id": (w or {}).get("id"), "abstract": r.get("abstract") or abstract_from_inverted((w or {}).get("abstract_inverted_index")), "abstract_source": "pubmed" if r.get("abstract") else ("openalex" if w else None),
        "cited_by_count": (w or {}).get("cited_by_count"), "oa_url": ((w or {}).get("open_access") or {}).get("oa_url"),
        "landing_url": f"https://pubmed.ncbi.nlm.nih.gov/{r['pmid']}/", "keywords": list(dict.fromkeys(r.get("keywords", []) + r.get("mesh", [])[:12])),
        "links": links, "has_pdf": False, "citation": None, "citation_original": None, "commentaries": [],
        "tags": {"topic": [], "approach": [], "type": typ}, "summary": "", "key_finding": "", "free_keywords": [],
        "classification": None, "date_added": TODAY, "source": "pubmed",
    }
    rec["citation"] = nlm_citation(r)
    papers.append(rec)

# the Nature Immunology 2026 paper has a published author correction
for p in papers:
    if p["pmid"] == "41872505":
        p["note"] = "An author correction was published in Nat Immunol 27(6):1306 (2026), doi:10.1038/s41590-026-02525-3."

# book chapters listed on the old site that are not in PubMed
papers += [
    {"id": "redente2015innate", "title": "Innate Immunity", "authors": ["Redente, E. F.", "Jakubzick, C.", "Martin, T. R.", "Riches, D. W."], "authors_short": ["Redente EF", "Jakubzick C", "Martin TR", "Riches DW"], "authors_truncated": False,
     "year": 2015, "date": "2015-01-01", "status": "published", "kind": "chapter", "journal": "Murray and Nadel's Textbook of Respiratory Medicine (6th ed.)", "volume": None, "issue": None, "pages": None, "doi": "10.1016/B978-1-4557-3383-5.00012-9", "pmid": None, "pmcid": None,
     "openalex_id": None, "abstract": "", "abstract_source": None, "cited_by_count": None, "oa_url": None, "landing_url": None, "keywords": [], "links": [{"type": "publisher", "label": "Publisher", "url": "https://doi.org/10.1016/B978-1-4557-3383-5.00012-9"}], "has_pdf": False,
     "citation": "Redente EF, Jakubzick C, Martin TR, Riches DW. Innate Immunity. In: Murray and Nadel's Textbook of Respiratory Medicine. 6th ed. Elsevier; 2015.", "citation_original": "Redente EF, Jakubzick C, Martin TR, and Riches DW. Innate Immunity. Chapter: Murray and Nadels Textbook of Respiratory Medicine. 2015", "commentaries": [],
     "tags": {"topic": [], "approach": [], "type": "chapter"}, "summary": "", "key_finding": "", "free_keywords": [], "classification": None, "date_added": TODAY, "source": "old site"},
    {"id": "jakubzick2020innate", "title": "Innate Immunity", "authors": ["Jakubzick, C.", "Redente, E. F.", "Martin, T. R.", "Riches, D. W."], "authors_short": ["Jakubzick C", "Redente EF", "Martin TR", "Riches DW"], "authors_truncated": False,
     "year": 2020, "date": "2020-01-01", "status": "published", "kind": "chapter", "journal": "Murray and Nadel's Textbook of Respiratory Medicine (7th ed.)", "volume": None, "issue": None, "pages": None, "doi": None, "pmid": None, "pmcid": None,
     "openalex_id": None, "abstract": "", "abstract_source": None, "cited_by_count": None, "oa_url": None, "landing_url": None, "keywords": [], "links": [], "has_pdf": False,
     "citation": "Jakubzick C, Redente EF, Martin TR, Riches DW. Innate Immunity. In: Murray and Nadel's Textbook of Respiratory Medicine. 7th ed. Elsevier; 2020.", "citation_original": "Jakubzick C, Redente EF, Martin TR, and Riches DW. Innate Immunity. Chapter: Murray and Nadels Textbook of Respiratory Medicine. 2020", "commentaries": [],
     "tags": {"topic": [], "approach": [], "type": "chapter"}, "summary": "", "key_finding": "", "free_keywords": [], "classification": None, "date_added": TODAY, "source": "old site"},
]
ids = [p["id"] for p in papers]
assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
papers.sort(key=lambda p: (-(p["year"] or 0), p["date"] or ""), reverse=False)
(ROOT / "data").mkdir(exist_ok=True)
json.dump(papers, open(ROOT / "data" / "papers.json", "w"), ensure_ascii=False, indent=1)
print(f"{len(papers)} papers written; {sum(1 for p in papers if p['cited_by_count'] is not None)} matched to OpenAlex; {sum(1 for p in papers if not p['abstract'])} without abstract")
print("--- OpenAlex works not in PubMed (review; not added) ---")
for w in oa:
    if w["id"] in used_oa:
        continue
    d = (w.get("doi") or "")
    if re.search(r"\.s\d{3}$", d) or (w.get("title") or "").split("_")[0] in ("Table 1", "Table 2", "Table 3", "Presentation 1", "Data Sheet 1"):
        continue
    src = ((w.get("primary_location") or {}).get("source") or {}).get("display_name")
    print(w.get("publication_year"), w.get("type"), "|", src, "|", (w.get("title") or "")[:90], "|", d.replace("https://doi.org/", ""))
