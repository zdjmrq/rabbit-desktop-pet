"""Assemble the eight generated desktop-only actions after hatch-pet frame extraction."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


ACTIONS = ("groom", "stretch", "look", "sleep", "eat", "spin", "pet", "carry")
CELL = (192, 208)
FRAME_COUNT = 6
COLUMNS = 8


def normalized(frame: Image.Image) -> Image.Image:
    rgba = frame.convert("RGBA")
    if rgba.size != CELL:
        raise ValueError(f"expected {CELL}, got {rgba.size}")
    pixels = list(rgba.get_flattened_data())
    if not any(alpha > 16 for _, _, _, alpha in pixels):
        raise ValueError("blank frame")
    rgba.putdata([(0, 0, 0, 0) if alpha == 0 else (red, green, blue, alpha)
                  for red, green, blue, alpha in pixels])
    return rgba


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    output = Path(args.output).resolve()
    atlas = Image.new("RGBA", (COLUMNS * CELL[0], len(ACTIONS) * CELL[1]))
    preview_scale = 0.5
    slot_width, slot_height = (int(CELL[0] * preview_scale), int(CELL[1] * preview_scale))
    label_width = 80
    contact = Image.new("RGB", (label_width + COLUMNS * slot_width, len(ACTIONS) * slot_height), "white")
    draw = ImageDraw.Draw(contact)
    report: dict[str, object] = {"ok": True, "size": list(atlas.size), "rows": {}}

    for row, action in enumerate(ACTIONS):
        frame_dir = run_dir / "extras" / "staging" / action / "frames" / "idle"
        action_frames = []
        for column in range(FRAME_COUNT):
            path = frame_dir / f"{column:02d}.png"
            if not path.is_file():
                raise FileNotFoundError(path)
            with Image.open(path) as opened:
                frame = normalized(opened)
            atlas.alpha_composite(frame, (column * CELL[0], row * CELL[1]))
            action_frames.append(str(path))

            thumb = frame.resize((slot_width, slot_height), Image.Resampling.LANCZOS)
            slot = Image.new("RGBA", (slot_width, slot_height), (242, 242, 242, 255))
            slot.alpha_composite(thumb)
            contact.paste(slot.convert("RGB"), (label_width + column * slot_width, row * slot_height))
        draw.text((5, row * slot_height + 8), action, fill="black")
        report["rows"][action] = {"row": row, "frames": FRAME_COUNT, "sources": action_frames}

    output.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(output, format="WEBP", lossless=True, method=6)
    contact_path = run_dir / "extras" / "contact-sheet.png"
    contact.save(contact_path)
    report_path = run_dir / "extras" / "validation.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "atlas": str(output), "contact_sheet": str(contact_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
