"""Update the public recipe snapshot from the latest signed Android test release.

The web user's shopping list stays in that browser's localStorage. This script
only copies public recipe content from the release APK.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_URL = "https://github.com/demirataalbuz-maker/sofra-updates/releases/latest/download/latest.json"
RELEASE_URL = "https://github.com/demirataalbuz-maker/sofra-updates/releases/download/v{version}/sofra.apk"


def load_url(url: str, limit: int) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Sofra-Aile-Catalog-Sync"})
    with urllib.request.urlopen(req, timeout=90) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Download exceeds the allowed size")
    return data


def picture_paths(value: object, paths: set[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "image" and isinstance(child, str) and child.startswith("/images/"):
                paths.add(child.removeprefix("/"))
            else:
                picture_paths(child, paths)
    elif isinstance(value, list):
        for child in value:
            picture_paths(child, paths)


def replace_pictures(value: object, mapping: dict[str, str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key == "image" and isinstance(child, str) and child in mapping:
                value[key] = mapping[child]
            else:
                replace_pictures(child, mapping)
    elif isinstance(value, list):
        for child in value:
            replace_pictures(child, mapping)


def run(args: argparse.Namespace) -> None:
    output = args.output.resolve()
    state_file = ROOT / "sync-state.json"
    state = json.loads(state_file.read_text(encoding="utf-8"))
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8") if args.manifest else load_url(MANIFEST_URL, 32_000))
    version = manifest.get("versionName")
    code = manifest.get("versionCode")
    if manifest.get("packageName") != "tr.sofra.mutfak" or not isinstance(code, int) or not isinstance(version, str) or not re.fullmatch(r"\d+(?:\.\d+)+", version):
        raise ValueError("Unexpected release identity")
    url = RELEASE_URL.format(version=version)
    chunks = manifest.get("chunks")
    if not isinstance(chunks, list) or len(chunks) != 1 or chunks[0].get("url") != url:
        raise ValueError("Unexpected APK address")
    digest = manifest.get("sha256")
    size = manifest.get("size")
    if not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest) or not isinstance(size, int) or not 0 < size < 600 * 1024 * 1024:
        raise ValueError("Unexpected APK metadata")
    if chunks[0].get("sha256") != digest or chunks[0].get("size") != size:
        raise ValueError("APK part metadata differs")
    if code <= state["versionCode"] and not args.force:
        print(f"Already synchronized: Android versionCode {state['versionCode']}")
        return
    if code < state["versionCode"]:
        raise ValueError("Refusing to roll back the website")
    apk = Path(args.apk).read_bytes() if args.apk else load_url(url, 600 * 1024 * 1024)
    if len(apk) != size or hashlib.sha256(apk).hexdigest() != digest:
        raise ValueError("APK hash or size differs from release manifest")
    credit_rows = json.loads((ROOT / "photo-credits.json").read_text(encoding="utf-8"))
    licensed = {row["image"].lstrip("/") for row in credit_rows}
    known = set(json.loads((ROOT / "known-image-sources.json").read_text(encoding="utf-8")))
    with zipfile.ZipFile(io.BytesIO(apk)) as archive:
        catalog_data = archive.read("assets/catalog.json")
        if len(catalog_data) > 10_000_000:
            raise ValueError("Catalog is unexpectedly large")
        catalog = json.loads(catalog_data)
        if not isinstance(catalog.get("recipes"), list) or len(catalog["recipes"]) < 458 or not isinstance(catalog.get("ingredients"), dict):
            raise ValueError("Catalog appears incomplete")
        paths: set[str] = set()
        picture_paths(catalog["recipes"], paths)
        for path in paths:
            if not re.fullmatch(r"images/[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)", path):
                raise ValueError(f"Unexpected image path: {path}")
            if path not in known and path not in licensed and not re.fullmatch(r"images/(?:cover|step|guide|technique)-[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp)", path):
                raise ValueError(f"New image needs source review before public release: {path}")
            if path.startswith("images/licensed-") and path not in licensed:
                raise ValueError(f"New licensed photo lacks attribution: {path}")
            info = archive.getinfo("assets/" + path)
            if info.file_size > 20 * 1024 * 1024:
                raise ValueError(f"Image is too large: {path}")
        mapping: dict[str, str] = {}
        images_dir = output / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        for path in sorted(paths):
            raw = archive.read("assets/" + path)
            if path in licensed:
                target = output / path
                target.write_bytes(raw)  # Attribution says licensed thumbnails stay byte-for-byte.
                mapping["/" + path] = path
            else:
                stem = Path(path).stem
                name = f"{stem}-{hashlib.sha1(path.encode()).hexdigest()[:7]}.webp"
                target = images_dir / name
                if not target.exists():
                    with Image.open(io.BytesIO(raw)) as original:
                        image = ImageOps.exif_transpose(original)
                        if image.width > 1400:
                            image = image.resize((1400, round(image.height * 1400 / image.width)), Image.Resampling.LANCZOS)
                        image.save(target, format="WEBP", quality=78, method=5)
                mapping["/" + path] = "images/" + name
        replace_pictures(catalog["recipes"], mapping)
    output.mkdir(parents=True, exist_ok=True)
    (output / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    (output / "sync-state.json").write_text(json.dumps({"versionCode": code, "versionName": version, "apkSha256": digest}, indent=2) + "\n", encoding="utf-8")
    print(f"Synchronized {len(catalog['recipes'])} recipes and {len(paths)} photos from Android v{version} (code {code})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", help="Local manifest for a test run")
    parser.add_argument("--apk", help="Local APK for a test run")
    parser.add_argument("--output", type=Path, default=ROOT)
    parser.add_argument("--force", action="store_true", help="Rebuild the current version for validation")
    try:
        run(parser.parse_args())
    except Exception as exc:
        print(f"Catalog synchronization failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
