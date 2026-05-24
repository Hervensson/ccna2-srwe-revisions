from __future__ import annotations

import argparse
import json
import re
import shutil
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"w": W, "a": A, "r": R}

DEFAULT_DOCX = Path(r"C:\Users\casim\OneDrive - ESIEE Paris\CCNA2\CCNA 2 SRWE.docx")
QUESTION_RE = re.compile(r"^(\d+)(?:\.\s+|\s+)(.*)")
EXPLANATION_RE = re.compile(r"^(Explication|Explique)\s*[:：]", re.I)
FOOTER_RE = re.compile(r"CCNA\s+2.*Réponses\s+Français\s*\d*$", re.I)
MULTI_RE = re.compile(r"chois\w*\s+(deux|trois|quatre|2|3|4)", re.I)
NUMBER_WORDS = {"deux": 2, "2": 2, "trois": 3, "3": 3, "quatre": 4, "4": 4}

THEME_RULES = [
    ("VLAN / Trunk / Inter-VLAN", r"\bVLAN\b|tronc|tronçon|trunk|jonction|inter-?VLAN|DTP|VTP|natif"),
    ("STP / EtherChannel", r"STP|RSTP|PVST|spanning|pont racine|EtherChannel|PAgP|LACP|agrégation"),
    ("Routage IPv4/IPv6", r"route statique|routage|routeur|CEF|table de routage|passerelle|tronçon suivant|IPv6|préfixe|lien-local|SLAAC"),
    ("DHCP / Adressage", r"DHCP|DHCPv4|DHCPv6|DNS|adresse IP|ARP|Neighbor|sollicitation|annonce"),
    ("WLAN / Sans fil", r"WLAN|Wi-?Fi|sans fil|SSID|WPA|WEP|AES|TKIP|point d.?accès|WLC|routeur sans fil"),
    ("Sécurité LAN", r"sécurité|attaque|snooping|inspection|802\.1X|authentif|PortFast|BPDU|usurpation|empoisonnement|source guard"),
    ("Commutation / Interfaces", r"commutateur|switch|interface|MAC|trame|duplex|shutdown|show interfaces|table d.?adresses"),
    ("FHRP / HSRP", r"HSRP|routeur virtuel|routeur de secours|routeur actif|routeur en veille"),
]


def clean(text: str) -> str:
    text = text.replace("\u00a0", " ")
    return re.sub(r"\s+", " ", text).strip()


def paragraph_info(paragraph: ET.Element, relmap: dict[str, str]) -> dict:
    text_parts: list[str] = []
    total = 0
    bold = 0

    for run in paragraph.findall("w:r", NS):
        run_text = "".join(t.text or "" for t in run.findall(".//w:t", NS))
        text_parts.append(run_text)
        total += len(run_text)
        props = run.find("w:rPr", NS)
        is_bold = props is not None and (
            props.find("w:b", NS) is not None or props.find("w:bCs", NS) is not None
        )
        if is_bold:
            bold += len(run_text)

    images: list[str] = []
    for blip in paragraph.findall(".//a:blip", NS):
        rel_id = blip.attrib.get(f"{{{R}}}embed")
        target = relmap.get(rel_id or "")
        if target and target.startswith("media/"):
            images.append(f"assets/{Path(target).name}")

    return {
        "text": clean("".join(text_parts)),
        "bold": bold / total if total else 0,
        "images": images,
    }


def read_docx(docx: Path, output_dir: Path) -> list[dict]:
    assets_dir = output_dir / "assets"
    assets_dir.mkdir(exist_ok=True)

    with zipfile.ZipFile(docx) as archive:
        rels = ET.fromstring(archive.read("word/_rels/document.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        root = ET.fromstring(archive.read("word/document.xml"))

        for name in archive.namelist():
            if name.startswith("word/media/"):
                target = assets_dir / Path(name).name
                with archive.open(name) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src, dst)

    blocks: list[dict] = []
    current: dict | None = None
    for paragraph in root.findall(".//w:p", NS):
        info = paragraph_info(paragraph, relmap)
        match = QUESTION_RE.match(info["text"]) if info["text"] else None
        if match and 1 <= int(match.group(1)) <= 174:
            if current:
                blocks.append(current)
            current = {
                "sourceNumber": int(match.group(1)),
                "events": [{**info, "text": clean(match.group(2))}],
            }
        elif current and (info["text"] or info["images"]):
            current["events"].append(info)

    if current:
        blocks.append(current)
    return blocks


def is_footer(text: str) -> bool:
    return bool(FOOTER_RE.search(text))


def expected_choices(question: str, correct_count: int, qtype: str) -> int:
    if qtype in {"study", "matching"}:
        return 0
    match = MULTI_RE.search(question)
    if match:
        return NUMBER_WORDS.get(match.group(1).lower(), correct_count or 1)
    return correct_count or 1


def theme_for(question: dict) -> str:
    corpus = " ".join(
        [
            question.get("question", ""),
            " ".join(question.get("options", [])),
            question.get("explanation", ""),
        ]
    )
    scores: list[tuple[int, str]] = []
    for theme, pattern in THEME_RULES:
        hits = len(re.findall(pattern, corpus, re.I))
        if hits:
            scores.append((hits, theme))
    return max(scores)[1] if scores else "Concepts réseau"


def matching_from_options(options: list[str]) -> dict | None:
    if len(options) < 2 or len(options) % 2 != 0:
        return None
    answers = options[1::2]
    return {
        "prompts": options[::2],
        "answers": list(dict.fromkeys(answers)),
        "correct": answers,
    }


def manual_matching(source_number: int, question_text: str) -> dict | None:
    if source_number == 55 and "caractéristique de transmission" in question_text:
        return {
            "prompts": [
                "Convient aux applications informatiques hautement performantes.",
                "Contrôle les erreurs avant la transmission.",
                "Le processus de transmission peut démarrer dès la réception de l'adresse de destination.",
                "Le processus de transmission peut démarrer uniquement après avoir reçu la totalité de la trame.",
                "Les trames non valides peuvent être transmises.",
                "Seules les trames valides sont transmises.",
            ],
            "answers": ["Cut-Through", "Store-and-Forward"],
            "correct": [
                "Cut-Through",
                "Store-and-Forward",
                "Cut-Through",
                "Store-and-Forward",
                "Cut-Through",
                "Store-and-Forward",
            ],
        }
    return None


def is_matching_question(question: str) -> bool:
    return bool(re.search(r"(Associez|Faites correspondre|ordre du processus|séquence des étapes)", question, re.I))


def parse_blocks(blocks: list[dict]) -> list[dict]:
    questions: list[dict] = []
    for index, block in enumerate(blocks, 1):
        images: list[str] = []
        rows: list[dict] = []
        for event in block["events"]:
            for image in event["images"]:
                if image not in images:
                    images.append(image)
            if event["text"]:
                rows.append({"text": event["text"], "bold": event["bold"]})

        explanation_index = next((i for i, row in enumerate(rows) if EXPLANATION_RE.match(row["text"])), None)
        if explanation_index is not None:
            explanation = " ".join(row["text"] for row in rows[explanation_index:])
            rows = rows[:explanation_index]
        else:
            explanation = ""

        rows = [row for row in rows if not is_footer(row["text"])]
        if not rows:
            continue

        question_lines = [rows[0]["text"]]
        option_start = 1
        cursor = 1
        while cursor < len(rows):
            joined = " ".join(question_lines)
            text = rows[cursor]["text"]
            looks_like_context = bool(re.match(r"^[A-Z][A-Z0-9-]+#", text, re.I))
            followup_question = rows[cursor]["bold"] > 0.75 and text.endswith("?") and not joined.endswith("?")
            if joined.endswith(":") or looks_like_context or followup_question:
                question_lines.append(text)
                cursor += 1
                option_start = cursor
                continue
            break

        options: list[str] = []
        correct: list[int] = []
        for row in rows[option_start:]:
            text = row["text"].strip()
            if not text:
                continue
            starred = text.endswith("*")
            text = text.rstrip("*").strip()
            option_index = len(options)
            options.append(text)
            if starred or row["bold"] > 0.55:
                correct.append(option_index)

        question_text = "\n".join(question_lines).strip()
        manual_match = manual_matching(block["sourceNumber"], question_text)
        option_match = matching_from_options(options) if is_matching_question(question_text) else None
        qtype = "matching" if manual_match or option_match else ("study" if is_matching_question(question_text) or not options or not correct else ("multi" if len(correct) > 1 else "single"))
        item = {
            "id": index,
            "sourceNumber": block["sourceNumber"],
            "question": question_text,
            "options": options,
            "correct": correct,
            "explanation": clean(re.sub(r"Explication\s*:\s*", "Explication : ", explanation)),
            "images": images,
            "type": qtype,
        }
        if manual_match or option_match:
            item["matching"] = manual_match or option_match
        item["expectedChoices"] = expected_choices(question_text, len(correct), qtype)
        item["theme"] = theme_for(item)
        questions.append(item)

    return questions


def main() -> None:
    parser = argparse.ArgumentParser(description="Extrait la banque CCNA 2 SRWE depuis le fichier Word.")
    parser.add_argument("--docx", type=Path, default=DEFAULT_DOCX, help="Chemin du fichier .docx source.")
    parser.add_argument("--out", type=Path, default=Path.cwd(), help="Dossier de sortie de questions.js et assets/.")
    args = parser.parse_args()

    blocks = read_docx(args.docx, args.out)
    questions = parse_blocks(blocks)
    payload = "window.CCNA_QUESTIONS = " + json.dumps(questions, ensure_ascii=False, indent=2) + ";\n"
    (args.out / "questions.js").write_text(payload, encoding="utf-8")

    gradable = sum(question["type"] != "study" for question in questions)
    print(f"{len(questions)} questions extraites, {gradable} notées, {len(questions) - gradable} associations.")


if __name__ == "__main__":
    main()
