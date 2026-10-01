#!/usr/bin/env python3
"""Build the Stotra Reader pages from the sanskritdocuments.org sources.

Reads the Devanagari text from the site's HTML rendering of each document
(sources/*.html, downloaded on first run), splits it into sections and
recitation units without changing a single character of the verses, and
writes:

  index.html           standalone page (doctype, head, body)
  build/artifact.html  same page without the document skeleton, for claude.ai

Usage: python3 tools/build.py
"""
import html
import json
import os
import re
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "sources")
BASE = "https://sanskritdocuments.org"
FILES = {
	"vsahasranew.html": "/doc_vishhnu/vsahasranew.html",
	"vsahasranew.itx": "/doc_vishhnu/vsahasranew.itx",
	"hanuman40.html": "/doc_hanumaana/hanuman40.html",
	"hanuman40.itx": "/doc_hanumaana/hanuman40.itx",
}

DEV_DIGITS = "०१२३४५६७८९"


def fetch_sources():
	os.makedirs(SRC, exist_ok=True)
	for name, path in FILES.items():
		dest = os.path.join(SRC, name)
		if not os.path.exists(dest):
			print("downloading", BASE + path)
			urllib.request.urlretrieve(BASE + path, dest)


def pre_text(name):
	"""Return the <PRE> body of a sanskritdocuments.org HTML page as lines."""
	s = open(os.path.join(SRC, name), encoding="utf-8").read()
	a = s.find("<PRE")
	b = s.find("</PRE>", a)
	body = s[s.find(">", a) + 1:b]
	return html.unescape(body).split("\n")


def dev_to_int(s):
	return int("".join(str(DEV_DIGITS.index(c)) for c in s))


def make_unit(lines, label):
	lines = [l.strip() for l in lines if l.strip()]
	u = {"lines": lines}
	m = re.search(r"॥\s*([०-९]+)\s*॥", lines[-1])
	if m:
		u["n"] = dev_to_int(m.group(1))
	if label:
		u["label"] = label
	if lines[0].startswith("(") and lines[-1].rstrip().endswith(")"):
		u["alt"] = True
	return u


# ---------------------------------------------------------------- Vishnu Sahasranama

VS_SECTIONS = [
	# id, Devanagari heading, Latin heading (None = transliterate), English gloss
	("purva", "पूर्वपीठिका", None, "Opening"),
	("nyasa", "पूर्वन्यासः", None, "Invocation and nyāsa"),
	("dhyana", "ध्यानम्", None, "Meditation"),
	("stotram", "स्तोत्रम्", None, "The thousand names"),
	("phala", "उत्तरन्यासः, फलश्रुतिः", None, "Closing and fruits of recitation"),
	("additional", "", "Additional Concluding Shlokas", "As given in the source"),
	("alternate", "", "Alternate Concluding Shlokas", "As given in the source"),
]


# Invocation lines that close their own recitation unit even without a ॥.
STANDALONE = {"श्रीपरमात्मने नमः ।", "हरिः ॐ ।"}


def parse_vs():
	lines = pre_text("vsahasranew.html")
	sections = {sid: [] for sid, *_ in VS_SECTIONS}
	cur = "purva"
	buf, label = [], None

	def flush():
		nonlocal buf, label
		if any(l.strip() for l in buf):
			sections[cur].append(make_unit(buf, label))
			label = None
		buf = []

	for raw in lines:
		line = raw.rstrip()
		s = line.strip()
		if s == "NA":  # start of the editor's notes after the text
			break
		if s.startswith("<h2"):
			flush()
			if 'itemprop="name"' in s:
				continue  # document title
			head = re.sub(r"<[^>]+>", "", s).strip()
			cur = {"पूर्वन्यासः": "nyasa", "स्तोत्रम्": "stotram", "उत्तरन्यासः, फलश्रुतिः": "phala"}[head]
			continue
		if s == "Additional Concluding Shlokas":
			flush(); cur = "additional"; continue
		if s == "Alternate Concluding Shlokas":
			flush(); cur = "alternate"; continue
		if not s:
			flush(); continue
		if s == "अथ ध्यानम् ।":
			flush(); cur = "dhyana"; label = s; continue
		if s.endswith("---"):  # speaker: "भीष्म उवाच ---"
			flush(); label = s[:-3].strip(); continue
		if re.fullmatch(r"अथ \S+ ।", s):  # "अथ न्यासः ।" sub-heading
			flush(); label = s; continue
		if s.endswith("ॐ नम इति ।"):  # refrain line between verses
			flush(); buf = [s]; flush(); continue
		if s.startswith("(") and buf:
			flush()
		buf.append(line)
		if "॥" in s or s in STANDALONE:
			flush()
	flush()

	out = []
	for sid, dev, lat, gloss in VS_SECTIONS:
		out.append({"id": sid, "dev": dev, "lat": lat, "gloss": gloss, "units": sections[sid]})
	return out


# ---------------------------------------------------------------- Hanuman Chalisa

def parse_hc():
	lines = [l.strip() for l in pre_text("hanuman40.html")]
	lines = [l for l in lines if l and not l.startswith("<h2")]
	marks = [i for i, l in enumerate(lines) if l in ("दोहा", "चौपाई", "आरती")]
	assert [lines[i] for i in marks] == ["दोहा", "चौपाई", "दोहा", "आरती"], marks
	blocks = []
	for k, i in enumerate(marks):
		end = marks[k + 1] if k + 1 < len(marks) else len(lines)
		blocks.append(lines[i + 1:end])
	doha1, chaupai, doha2, aarti = blocks

	def pairs(ls):
		assert len(ls) % 2 == 0, len(ls)
		return [ls[i:i + 2] for i in range(0, len(ls), 2)]

	def numbered(groups):
		return [{"lines": g, "n": i + 1, "auto": True} for i, g in enumerate(groups)]

	jaya = aarti[-1]
	assert jaya.startswith("॥ सियावर"), jaya
	aarti_units = [{"lines": g} for g in pairs(aarti[:-1])] + [{"lines": [jaya]}]
	return [
		{"id": "doha-open", "dev": "दोहा", "lat": None, "gloss": "Opening", "units": numbered(pairs(doha1))},
		{"id": "chaupai", "dev": "चौपाई", "lat": None, "gloss": "Forty verses", "units": numbered(pairs(chaupai))},
		{"id": "doha-close", "dev": "दोहा", "lat": None, "gloss": "Closing", "units": [{"lines": doha2}]},
		{"id": "aarti", "dev": "आरती", "lat": None, "gloss": "As given in the source", "units": aarti_units},
	]


def build():
	fetch_sources()
	vs = parse_vs()
	hc = parse_hc()
	data = {
		"vs": {
			"id": "vs",
			"short": "Vishnu Sahasranama",
			"dev": "श्रीविष्णुसहस्रनामस्तोत्रम्",
			"lat": "Śrī Viṣṇu Sahasranāma Stotram",
			"meta": "Mahābhārata, Anuśāsana Parva, Adhyāya 149",
			"hindi": False,
			"source": BASE + "/doc_vishhnu/vsahasranew.html",
			"pdf": BASE + "/doc_vishhnu/vsahasranew.pdf",
			"sections": vs,
		},
		"hc": {
			"id": "hc",
			"short": "Hanuman Chalisa",
			"dev": "श्रीहनुमान चालीसा",
			"lat": "Śrī Hanumāna Cālīsā",
			"meta": "Gosvāmī Tulasīdāsa, in Awadhi",
			"hindi": True,
			"source": BASE + "/doc_hanumaana/hanuman40.html",
			"pdf": BASE + "/doc_hanumaana/hanuman40.pdf",
			"sections": hc,
		},
	}
	payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
	tpl = open(os.path.join(ROOT, "src", "template.html"), encoding="utf-8").read()
	page = tpl.replace("/*__DATA__*/null", payload)
	assert page != tpl, "data placeholder missing from template"

	head, rest = page.split("<!--BODY-->", 1)
	body, tail = rest.split("<!--/BODY-->", 1)
	head_inner = head.split("<!--HEAD-->", 1)[1].split("<!--/HEAD-->", 1)[0]
	open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(page)

	# Artifact: no doctype/html/head/body, title first, viewport meta supplied by the host.
	head_art = re.sub(r"\s*<meta[^>]*>", "", head_inner)
	os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
	art = head_art.strip() + "\n" + body.strip() + "\n"
	open(os.path.join(ROOT, "build", "artifact.html"), "w", encoding="utf-8").write(art)

	for t in data.values():
		counts = ", ".join(f"{s['id']}={len(s['units'])}" for s in t["sections"])
		print(t["short"], "->", counts)
	print("wrote index.html (%d KB), build/artifact.html (%d KB)" % (len(page.encode()) // 1024, len(art.encode()) // 1024))


if __name__ == "__main__":
	build()
