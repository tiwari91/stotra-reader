#!/usr/bin/env node
// Checks for Stotra Reader. Run after `python3 tools/build.py`:
//   node tools/check.mjs
// 1. verse counts and numbering in the embedded data
// 2. the embedded text matches the sanskritdocuments.org Devanagari line for line
// 3. the in-page Devanagari-to-IAST function agrees with an independent
//    ITRANS-to-IAST conversion of the same documents' .itx sources
// 4. hand-checked transliteration samples
// 5. the artifact build follows the claude.ai page contract
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
const ok = (cond, msg) => {
	console.log((cond ? "  ok   " : "  FAIL ") + msg);
	if (!cond) failures++;
};

const page = read("index.html");
const DATA = JSON.parse(page.split("const DATA = ")[1].split(";\n")[0]);
const tl = page.split("// <translit>")[1].split("// </translit>")[0];
const deva2iast = new Function(tl + "\nreturn deva2iast;")();

// ---------------------------------------------------------------- 1. counts
console.log("Verse counts");
const sec = (t, id) => DATA[t].sections.find((s) => s.id === id);
const nums = (s) => s.units.filter((u) => u.n).map((u) => u.n);
const seq = (n) => Array.from({ length: n }, (_, i) => i + 1);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const [id, n] of [ [ "purva", 22 ], [ "dhyana", 7 ], [ "stotram", 108 ], [ "phala", 33 ] ]) {
	ok(same(nums(sec("vs", id)), seq(n)), `Vishnu Sahasranama ${id}: verses numbered 1..${n} in order`);
}
ok(sec("vs", "additional").units.length === 12, "Vishnu Sahasranama additional concluding shlokas: 12");
ok(sec("vs", "alternate").units.length === 14, "Vishnu Sahasranama alternate concluding shlokas: 13 + closing line");
ok(same(nums(sec("hc", "chaupai")), seq(40)) && sec("hc", "chaupai").units.every((u) => u.lines.length === 2), "Hanuman Chalisa: 40 chaupais of two lines");
ok(sec("hc", "doha-open").units.length === 2, "Hanuman Chalisa: 2 opening dohas");
ok(sec("hc", "doha-close").units.length === 1, "Hanuman Chalisa: 1 closing doha");
for (const t of Object.values(DATA)) {
	const units = t.sections.reduce((a, s) => a + s.units.length, 0);
	console.log(`       ${t.short}: ${units} recitation units`);
}

// ---------------------------------------------------------------- 2. fidelity
function preLines(file) {
	const s = fs.readFileSync(path.join(ROOT, "sources", file), "utf8");
	const a = s.indexOf("<PRE");
	const body = s.slice(s.indexOf(">", a) + 1, s.indexOf("</PRE>", a));
	const txt = body.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;/g, "'");
	return txt.split("\n");
}
const haveSources = fs.existsSync(path.join(ROOT, "sources", "vsahasranew.html"));
if (!haveSources) {
	console.log("Sources missing: run python3 tools/build.py to download them; skipping checks 2 and 3");
} else {
	console.log("Text fidelity against sanskritdocuments.org");
	const flatText = (t) => {
		const out = [];
		for (const s of DATA[t].sections) {
			for (const u of s.units) {
				if (u.label) out.push(u.label);
				out.push(...u.lines);
			}
		}
		return out;
	};
	const norm = (l) => l.trim().replace(/ ---$/, "");
	let src = [];
	for (const raw of preLines("vsahasranew.html")) {
		const l = raw.trim();
		if (l === "NA") break;
		if (!l || l.startsWith("<h2") || l === "Additional Concluding Shlokas" || l === "Alternate Concluding Shlokas") continue;
		src.push(norm(l));
	}
	let mine = flatText("vs").map(norm);
	let diff = src.findIndex((l, i) => l !== mine[i]);
	ok(src.length === mine.length && diff === -1, `Vishnu Sahasranama: ${mine.length} lines identical to source (${src.length})` + (diff >= 0 ? ` first difference at ${diff}: "${src[diff]}" vs "${mine[diff]}"` : ""));

	src = preLines("hanuman40.html").map((l) => l.trim()).filter((l) => l && !l.startsWith("<h2") && ![ "दोहा", "चौपाई", "आरती" ].includes(l));
	mine = flatText("hc");
	diff = src.findIndex((l, i) => l !== mine[i]);
	ok(src.length === mine.length && diff === -1, `Hanuman Chalisa: ${mine.length} lines identical to source (${src.length})` + (diff >= 0 ? ` first difference at ${diff}` : ""));

	// ------------------------------------------------------------ 3. ITRANS cross-check
	console.log("Transliteration against the ITRANS (.itx) sources");
	const ITRANS = [
		[ "R^i", "ṛ" ], [ "R^I", "ṝ" ], [ "L^i", "ḷ" ], [ "RRi", "ṛ" ], [ "~N", "ṅ" ], [ "~n", "ñ" ], [ "GY", "jñ" ],
		[ "OM", "oṃ" ], [ ".Dh", "ṛh" ], [ ".D", "ṛ" ], [ ".n", "ṃ" ], [ ".N", "m̐" ], [ ".a", "’" ], [ ".h", "" ],
		[ "chh", "ch" ], [ "shh", "ṣ" ], [ "Ch", "ch" ], [ "ch", "c" ], [ "kh", "kh" ], [ "gh", "gh" ], [ "jh", "jh" ],
		[ "Th", "ṭh" ], [ "Dh", "ḍh" ], [ "th", "th" ], [ "dh", "dh" ], [ "ph", "ph" ], [ "bh", "bh" ],
		[ "sh", "ś" ], [ "Sh", "ṣ" ], [ "aa", "ā" ], [ "ii", "ī" ], [ "uu", "ū" ], [ "ai", "ai" ], [ "au", "au" ],
		[ "A", "ā" ], [ "I", "ī" ], [ "U", "ū" ], [ "T", "ṭ" ], [ "D", "ḍ" ], [ "N", "ṇ" ], [ "M", "ṃ" ], [ "H", "ḥ" ],
		[ "x", "kṣ" ], [ "L", "ḷ" ], [ "w", "v" ],
	];
	function itrans2iast(s, hindi) {
		let out = "";
		for (let i = 0; i < s.length;) {
			const hit = ITRANS.find(([ k ]) => s.startsWith(k, i));
			if (hit) { out += hit[1]; i += hit[0].length; continue; }
			out += s[i++];
		}
		return out;
	}
	// Hindi: ITRANS R^i is the vowel (r̥ in our ISO output) while .D is ड़ (ṛ); map them apart.
	function itransHindi(s) {
		return itrans2iast(s.replace(/R\^i/g, "\u0001"), true).replace(/\u0001/g, "r̥");
	}
	const squash = (s) => s.replace(/\\-/g, "").replace(/[\s\d|.()\-{}_\\,;:'"?᳚]/g, "").replace(/ï/g, "i").replace(/ü/g, "u");
	function itxLines(file, hindi) {
		const s = fs.readFileSync(path.join(ROOT, "sources", file), "utf8");
		const body = s.split("\\endtitles ##")[1].split(/\n##\s*\n/)[0];
		return body.split("\n")
			.filter((l) => l.trim() && !l.trim().startsWith("\\") && !/^##.*##$/.test(l.trim()))
			.map((l) => squash(hindi ? itransHindi(l.replace(/##[^#]*##/g, "")) : itrans2iast(l.replace(/##[^#]*##/g, ""), false)))
			.filter(Boolean);
	}
	function devLines(file, hindi) {
		const out = [];
		for (const raw of preLines(file)) {
			const l = raw.trim();
			if (l === "NA") break;
			if (!l || l.startsWith("<h2") || /^[A-Za-z ]+$/.test(l)) continue;
			const t = squash(deva2iast(l.replace(/\(Alternatively/, "("), hindi));
			if (t) out.push(t);
		}
		return out;
	}
	for (const [ name, html, itx, hindi ] of [ [ "Vishnu Sahasranama", "vsahasranew.html", "vsahasranew.itx", false ], [ "Hanuman Chalisa", "hanuman40.html", "hanuman40.itx", true ] ]) {
		const a = devLines(html, hindi);
		const b = itxLines(itx, hindi);
		const bad = [];
		for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) bad.push(i);
		ok(a.length === b.length && bad.length === 0, `${name}: ${a.length} lines, Devanagari->IAST equals ITRANS->IAST on every line` + (bad.length ? ` (${bad.length} differ, first at ${bad[0]}: "${a[bad[0]]}" vs "${b[bad[0]]}")` : ""));
	}
}

// ---------------------------------------------------------------- 4. samples
console.log("Transliteration samples");
const SAMPLES = [
	[ "ॐ विश्वं विष्णुर्वषट्कारो भूतभव्यभवत्प्रभुः ।", false, "oṃ viśvaṃ viṣṇurvaṣaṭkāro bhūtabhavyabhavatprabhuḥ |" ],
	[ "अव्ययः पुरुषः साक्षी क्षेत्रज्ञोऽक्षर एव च ॥ २॥", false, "avyayaḥ puruṣaḥ sākṣī kṣetrajño’kṣara eva ca || 2||" ],
	[ "शङ्खभृन्नन्दकी चक्री शार्ङ्गधन्वा गदाधरः ।", false, "śaṅkhabhṛnnandakī cakrī śārṅgadhanvā gadādharaḥ |" ],
	[ "मालाकॢप्तासनस्थः", false, "mālākḷptāsanasthaḥ" ],
	[ "य इदं श‍ृणुयान्नित्यं", false, "ya idaṃ śṛṇuyānnityaṃ" ],
	[ "श्रीमाँल्लोकत्रयाश्रयः", false, "śrīmām̐llokatrayāśrayaḥ" ],
	[ "बरनऊँ रघुबर बिमल जसु", true, "baranaūm̐ raghubara bimala jasu" ],
	[ "संकट तें हनुमान छुड़ावै ।", true, "saṃkaṭa teṃ hanumāna chuṛāvai |" ],
	[ "कृपा करहु गुरु देव की नाईं ॥", true, "kr̥pā karahu guru deva kī nāīṃ ||" ],
	[ "जय हनुमान ज्ञान गुन सागर ।", true, "jaya hanumāna jñāna guna sāgara |" ],
];
for (const [ dev, hindi, want ] of SAMPLES) {
	const got = deva2iast(dev, hindi);
	ok(got === want, `${dev} -> ${got}` + (got === want ? "" : `  (want ${want})`));
}

// ---------------------------------------------------------------- 5. artifact contract
console.log("Artifact build");
const artPath = path.join(ROOT, "build", "artifact.html");
if (!fs.existsSync(artPath)) {
	ok(false, "build/artifact.html exists (run python3 tools/build.py)");
} else {
	const art = fs.readFileSync(artPath, "utf8");
	ok(!/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<\/body>|<\/html>/i.test(art), "no doctype/html/head/body tags");
	ok(/<title>[^<]+<\/title>/.test(art.slice(0, 8192)), "title within the first 8KB");
	const ext = [ ...art.matchAll(/(?:src|href)="(https?:[^"]+)"/g) ].map((m) => m[1]);
	const loads = [ ...art.matchAll(/<(?:link|script)[^>]+(?:src|href)="(https?:[^"]+)"/g) ].map((m) => m[1]);
	ok(loads.every((u) => /^https:\/\/fonts\.(googleapis|gstatic)\.com(\/|$)/.test(u)), "only Google Fonts loaded from outside (" + loads.length + " loads)");
	ok(!/\bfetch\(|XMLHttpRequest|import\(/.test(art), "no runtime fetches");
	ok(ext.filter((u) => !/fonts\.(googleapis|gstatic)/.test(u)).every((u) => u.startsWith("https://sanskritdocuments.org/")), "outbound links only to sanskritdocuments.org");
	ok(/:root\s*\{[^}]*--paper/.test(art) && /prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/.test(art) && /:root\[data-theme="dark"\]/.test(art), "theme tokens in the required shape");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
