# Stotra Reader

A one-page reader for two devotional texts:

- **Sri Vishnu Sahasranama Stotram** (Mahābhārata, Anuśāsana Parva 149): pūrvapīṭhikā (22 ślokas), pūrvanyāsa, dhyānam (7), the stotram (108), uttaranyāsa and phalaśruti (33), plus the additional and alternate concluding ślokas exactly as the source gives them.
- **Hanuman Chalisa** (Tulasīdāsa): 2 opening dohās, 40 caupāīs, the closing dohā, and the āratī that the source prints after it.

Open `index.html` in any browser, or serve the folder with GitHub Pages. Everything (text, styles, script) is inside that one file. Fonts come from Google Fonts and fall back to system Devanagari fonts when offline.

## Features

- Switch between the two texts; the app remembers which one you were reading and where.
- Devanagari, IAST, or both.
- Text size from 85% to 160%. Light (saffron on ivory) and dark (night) themes that follow the system, with a manual override.
- Recite mode: one verse at a time with previous/next buttons, arrow keys, or swipe; a progress bar; and a 108-bead mala counter (tap or press Space). The counter and recite position are saved per text.
- Section list and table of contents for jumping to the stotram, phalaśruti, chaupais and so on.
- Saved state lives in `localStorage` and the page works without it.

## Source text

Both texts are reproduced line for line from [sanskritdocuments.org](https://sanskritdocuments.org):

- [vsahasranew](https://sanskritdocuments.org/doc_vishhnu/vsahasranew.html) ([PDF](https://sanskritdocuments.org/doc_vishhnu/vsahasranew.pdf), [ITX](https://sanskritdocuments.org/doc_vishhnu/vsahasranew.itx))
- [hanuman40](https://sanskritdocuments.org/doc_hanumaana/hanuman40.html) ([ITX](https://sanskritdocuments.org/doc_hanumaana/hanuman40.itx))

Their texts are prepared by volunteers for personal study and research. Please keep the credit and the links if you share this page.

The Devanagari comes from each document's HTML edition (the same text as the PDF, without PDF extraction errors in conjuncts). Verse numbers for the Sahasranama are the source's own. The source does not number the Chalisa, so numbers there are added for reference.

## Transliteration

IAST is generated in the page from the Devanagari by `deva2iast()` (between the `// <translit>` markers in `src/template.html`). It handles anusvāra (ṃ), visarga (ḥ), candrabindu (m̐), avagraha (’), conjuncts and the vocalic ḷ. For the Chalisa it follows ISO 15919 where IAST has no letter (ड़ = ṛ, ढ़ = ṛh, so ऋ = r̥) and keeps every written vowel, since the meter counts them.

`tools/check.mjs` verifies the function against an independent ITRANS-to-IAST conversion of each document's `.itx` source, line by line, for all 491 Sahasranama lines and 103 Chalisa lines.

## Building and checking

```sh
python3 tools/build.py   # downloads sources/ on first run, writes index.html and build/artifact.html
node tools/check.mjs     # verse counts, text fidelity, transliteration, artifact contract
```

`src/template.html` is the page; `build.py` parses the sources into sections and verses and embeds them. `build/artifact.html` is the same page without the document skeleton, for publishing as a claude.ai artifact.
