#!/usr/bin/env python3
"""
gptimg.py — english_game『ともしび』挿絵を gpt-image-2 で生成する最小クライアント。

参照実装: ~/lbe/brainstorming_tool/packages/backend/src/llm/image_gateway.ts
  - OpenAI 互換 API (LiteLLM 経由) を OpenAI SDK で叩く。
  - 参照画像なし = images.generate / 参照画像あり = images.edit。
  - モデルは gpt-image-2 (env OPENAI_IMAGE_MODEL で上書き可)。

認証情報の読み込み (優先順):
  1. 環境変数 OPENAI_API_KEY / OPENAI_BASE_URL
  2. scripts/imggen/.env  (このリポジトリ内・gitignore 推奨)
  3. ~/lbe/brainstorming_tool/.env  (流用元・キーをコピーしたくない場合のフォールバック)

社内ホスト litellm.cel.sony.co.jp は社内プロキシ(proxy.kanto.sony.co.jp)を
バイパスする必要があるため、NO_PROXY に *.sony.co.jp / localhost を必ず注入する。

CLI:
  python gptimg.py generate --prompt "..." --out a.png [--size 1024x1536] [--n 1] \
      [--ref ref1.png ref2.png ...]
"""
from __future__ import annotations

import argparse
import base64
import os
import sys
from pathlib import Path

# --- 社内プロキシ・バイパス (import より前に効かせる) ---------------------------
_NO_PROXY = "cel.sony.co.jp,.sony.co.jp,litellm.cel.sony.co.jp,localhost,127.0.0.1"


def _ensure_no_proxy() -> None:
    existing = os.environ.get("NO_PROXY", "") or os.environ.get("no_proxy", "")
    merged = ",".join(filter(None, [existing, _NO_PROXY]))
    os.environ["NO_PROXY"] = merged
    os.environ["no_proxy"] = merged


def _load_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def _resolve_credentials() -> tuple[str, str, str]:
    """(api_key, base_url, image_model) を返す。"""
    here = Path(__file__).resolve().parent
    candidates = [
        here / ".env",
        Path.home() / "lbe" / "brainstorming_tool" / ".env",
    ]
    cfg: dict[str, str] = {}
    for c in candidates:
        for k, v in _load_env_file(c).items():
            cfg.setdefault(k, v)

    api_key = os.environ.get("OPENAI_API_KEY") or cfg.get("OPENAI_API_KEY", "")
    base_url = (
        os.environ.get("OPENAI_BASE_URL")
        or cfg.get("OPENAI_BASE_URL")
        or "https://litellm.cel.sony.co.jp:30443/v1"
    )
    image_model = (
        os.environ.get("OPENAI_IMAGE_MODEL")
        or cfg.get("OPENAI_IMAGE_MODEL")
        or "gpt-image-2"
    )
    if not api_key:
        sys.exit(
            "ERROR: OPENAI_API_KEY が見つかりません。環境変数か "
            "scripts/imggen/.env を設定してください。"
        )
    return api_key, base_url, image_model


def _client():
    from openai import OpenAI

    _ensure_no_proxy()
    api_key, base_url, _ = _resolve_credentials()
    return OpenAI(api_key=api_key, base_url=base_url, timeout=600.0)


def _save_b64(b64: str, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(b64))


def generate_image(
    prompt: str,
    out: str | Path,
    *,
    size: str = "1024x1536",
    n: int = 1,
    refs: list[str | Path] | None = None,
    model: str | None = None,
) -> list[Path]:
    """1枚以上の画像を生成して out (n>1 のときは out に _0,_1.. を付与) に保存。

    refs を渡すと images.edit (参照画像つき) で生成する。最大4枚。
    戻り値は保存したパスのリスト。
    """
    from openai import OpenAI  # noqa: F401  (型/例外の解決用)

    _, _, default_model = _resolve_credentials()
    model = model or default_model
    client = _client()
    out = Path(out)

    if refs:
        from openai import _legacy_response  # noqa: F401

        files = [open(Path(r), "rb") for r in list(refs)[:4]]
        try:
            resp = client.images.edit(
                model=model, image=files, prompt=prompt, n=n, size=size
            )
        finally:
            for f in files:
                f.close()
    else:
        resp = client.images.generate(model=model, prompt=prompt, n=n, size=size)

    saved: list[Path] = []
    data = resp.data or []
    for i, item in enumerate(data):
        b64 = getattr(item, "b64_json", None)
        if not b64:
            url = getattr(item, "url", None)
            if not url:
                continue
            import urllib.request

            target = out if len(data) == 1 else out.with_stem(f"{out.stem}_{i}")
            target.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(url, target)  # noqa: S310
            saved.append(target)
            continue
        target = out if len(data) == 1 else out.with_stem(f"{out.stem}_{i}")
        _save_b64(b64, target)
        saved.append(target)
    return saved


def main() -> None:
    p = argparse.ArgumentParser(description="gpt-image-2 image generator (english_game)")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="画像を生成")
    g.add_argument("--prompt", required=True)
    g.add_argument("--out", required=True)
    g.add_argument("--size", default="1024x1536")
    g.add_argument("--n", type=int, default=1)
    g.add_argument("--ref", nargs="*", default=None, help="参照画像 (最大4枚)")
    g.add_argument("--model", default=None)

    args = p.parse_args()
    if args.cmd == "generate":
        paths = generate_image(
            args.prompt,
            args.out,
            size=args.size,
            n=args.n,
            refs=args.ref,
            model=args.model,
        )
        for path in paths:
            print(f"saved: {path}")


if __name__ == "__main__":
    main()
