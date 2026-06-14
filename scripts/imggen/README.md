# english_game 挿絵生成基盤（gpt-image-2）

『ともしび』の挿絵を **gpt-image-2** で生成・描き直すためのデータ駆動基盤。
旧 Anima/ComfyUI 基盤（`~/llm/image_gen`）からの移行先。

## 構成

| ファイル | 役割 |
|---|---|
| `gptimg.py` | gpt-image-2 を叩く最小クライアント（generate / 参照画像つき edit）。CLI＋Python API。 |
| `cast.json` | **キャラ定義リスト**。各キャラの容姿・服・装備・色・表示方針・旧参照画像。 |
| `scenes.json` | **シーン定義＋舞台＋既存挿絵対応表**。各シーンの登場キャラ id・舞台・構図・キャプション・旧挿絵パス。 |
| `gen_cast.py` | cast.json から登場人物を1人1枚生成 → `out/cast/<id>.png`。 |
| `build_gallery.py` | `out/cast/` をレビュー用 HTML（`out/cast_gallery.html`）に並べる。 |
| `out/cast/` | 生成物（キャラ立ち絵）。これが以降シーン挿絵の参照画像ライブラリになる。 |

## 認証（API キー）

参照実装 `~/lbe/brainstorming_tool` の方式を流用：OpenAI 互換 API（LiteLLM 経由）を
OpenAI SDK で叩く。`gptimg.py` は次の優先順で認証情報を解決する。

1. 環境変数 `OPENAI_API_KEY` / `OPENAI_BASE_URL`
2. `scripts/imggen/.env`（このリポジトリ内・**git 管理しないこと**）
3. `~/lbe/brainstorming_tool/.env`（流用元・フォールバック）

- エンドポイント: `https://litellm.cel.sony.co.jp:30443/v1`
- モデル: `gpt-image-2`（`OPENAI_IMAGE_MODEL` で上書き可）
- **社内プロキシ回避**: 内部ホスト `litellm.cel.sony.co.jp` は社内プロキシをバイパス
  する必要があるため、`gptimg.py` が `NO_PROXY=*.sony.co.jp,localhost` を自動注入する。

## 使い方

```bash
# キャラを1人1枚ずつ生成（全員）
python gen_cast.py
# 一部だけ／旧Anima画像を likeness 参照として添付
python gen_cast.py --only yui gaku
python gen_cast.py --ref          # cast.json の ref_existing を images.edit に添付

# レビュー用 HTML を作る
python build_gallery.py           # → out/cast_gallery.html

# 任意プロンプトで1枚（参照画像つきも可）
python gptimg.py generate --prompt "..." --out out/test.png --size 1024x1536 \
    --ref out/cast/yui.png
```

## データ駆動の設計思想（くり返し描き直せる）

- **キャラの見た目は cast.json に一元化**。色・装備・髪型の正典をここで確定し、
  全プロンプトで使い回す（同一人物の担保）。
- **シーン挿絵は scenes.json 駆動**。各シーンは登場キャラ id（`ref_chars`）と舞台 id
  （`stage`）を参照する。生成時は `out/cast/<id>.png`（確定済みキャラ立ち絵）を
  **参照画像として `images.edit` に添付**して、同一人物・同一世界で描く。
- **既存挿絵対応表**（`existing_asset`）で旧 Anima 挿絵と新挿絵を突き合わせ、章を
  またいで描き直しの進捗を管理する。
- **POV ルール**: 主人公アキはシーン挿絵では極力映さない（`pov:true` のシーンは
  手＋カンテラ／肩越し／画面外）。

## 注意（安全フィルタ）

gpt-image-2 の安全フィルタは **プロンプト中の性的な単語（"breasts" 等）を否定文に
入れても [sexual] 違反として誤発火する**。negative には性的語を書かず、
"Keep it wholesome and modestly dressed." のような肯定表現で抑える。

## 次フェーズ（未実装・このフェーズの範囲外）

- `gen_scenes.py`: scenes.json を読み、`ref_chars` の立ち絵を添付してシーン挿絵を生成。
- 既存挿絵（ch1/ch2）の gpt-image-2 での全面描き直し。
