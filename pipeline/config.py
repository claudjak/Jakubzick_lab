import os
from pathlib import Path

# local runs: pick up secrets from a gitignored .env (KEY=value lines); CI uses repository secrets
_env = Path(__file__).resolve().parent.parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip())

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PAPERS = DATA / "papers.json"            # the bibliography (curated; every record is shown)
CANDIDATES = DATA / "candidates.json"    # daily-search finds awaiting approval (auto-tagged, shown in a queue)
SCREENED = DATA / "screened.json"        # everything the daily search has already looked at
SITE = ROOT / "site"
SITE_DATA = SITE / "data"

SITE_URL = os.environ.get("JLAB_SITE_URL", "https://torwager.github.io/jakubzicklab")
CONTACT_EMAIL = os.environ.get("JLAB_CONTACT_EMAIL", "")
TOOL_NAME = "jakubzicklab-site"
NCBI_API_KEY = os.environ.get("NCBI_API_KEY")
OPENALEX_API_KEY = os.environ.get("OPENALEX_API_KEY")

# Whose papers to look for. OpenAlex author IDs are the most reliable handle; PubMed uses an author + affiliation query.
OPENALEX_AUTHOR_IDS = [a for a in os.environ.get("JLAB_OPENALEX_AUTHORS", "A5036506329,A5141899363,A5138245526").split(",") if a]  # Claudia V. Jakubzick (main id + two small duplicates)
PUBMED_QUERY = '(Jakubzick C[Author] OR Jakubzick CV[Author])'
LAB_AUTHOR_SURNAMES = {"jakubzick"}

# News: Google News RSS queries about the lab and its work
NEWS_QUERIES = ['"Claudia Jakubzick"', '"Jakubzick" Dartmouth macrophage', '"Jakubzick lab"', '"Jakubzick" Geisel immunology']
FEED_CAP = 24
