#!/usr/bin/env python3
"""Inject the account switcher into an extracted ZCode asar tree.

Usage: python inject-account-switcher.py <extracted_out_dir> <ui_accounts.js> <main_module.mjs>

  <extracted_out_dir>  ... the "out" directory inside the extracted asar
  <ui_accounts.js>      ... renderer UI script
  <main_module.mjs>     ... main-process module

Modifications:
  1. copy main_module.mjs into out/main/zcode-account-switcher-main.mjs
  2. prepend a dynamic import of it into out/main/index.js (idempotent)
  3. inject ui_accounts.js into out/renderer/index.html before </body> (idempotent)
"""
import sys
from pathlib import Path

MAIN_IMPORT = 'import("./zcode-account-switcher-main.mjs").catch(()=>{});\n'
MAIN_MARKER = 'zcode-account-switcher-main.mjs'
RENDERER_MARKER = '<script id="zcode-account-switcher">'


def read_raw(p: Path) -> str:
    # newline='' preserves the file's original line endings exactly (no CRLF translation).
    with open(p, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write_raw(p: Path, s: str) -> None:
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(s)


def main() -> int:
    if len(sys.argv) != 4:
        print("[ERROR] usage: inject-account-switcher.py <extracted_out_dir> <ui_accounts.js> <main_module.mjs>")
        return 1

    out_dir = Path(sys.argv[1])
    ui_js = Path(sys.argv[2])
    main_mjs = Path(sys.argv[3])

    for p in (out_dir, ui_js, main_mjs):
        if not p.exists():
            print(f"[ERROR] missing: {p}")
            return 1

    # 1. copy main module
    main_dir = out_dir / "main"
    main_target = main_dir / "zcode-account-switcher-main.mjs"
    write_raw(main_target, read_raw(main_mjs))
    print(f"[1/3] main module copied -> {main_target.name}")

    # 2. prepend dynamic import to main entry
    main_entry = main_dir / "index.js"
    if not main_entry.exists():
        print(f"[ERROR] main entry not found: {main_entry}")
        return 1
    src = read_raw(main_entry)
    if MAIN_MARKER not in src:
        write_raw(main_entry, MAIN_IMPORT + src)
        print("[2/3] main entry patched (import prepended)")
    else:
        print("[2/3] main entry already patched, skip")

    # 3. inject renderer script
    html_path = out_dir / "renderer" / "index.html"
    if not html_path.exists():
        print(f"[ERROR] renderer index.html not found: {html_path}")
        return 1
    html = read_raw(html_path)
    js = read_raw(ui_js)
    tag = RENDERER_MARKER + "\n" + js + "\n</script>"
    idx = html.find(RENDERER_MARKER)
    if idx >= 0:
        # already injected -> REPLACE the whole previous script block so the
        # latest ui_accounts.js always wins (idempotent, no stale copies)
        end = html.find("</script>", idx)
        if end < 0:
            print("[ERROR] found marker but no closing </script>, abort")
            return 1
        html = html[:idx] + tag + html[end + len("</script>"):]
        print("[3/3] renderer script updated (replaced previous block)")
    else:
        if "</body>" not in html:
            print("[ERROR] </body> not found in index.html")
            return 1
        html = html.replace("</body>", tag + "\n</body>", 1)
        print("[3/3] renderer script injected")
    write_raw(html_path, html)

    print("[OK] injection complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
