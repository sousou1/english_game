#!/usr/bin/env bash
# SessionStart フック: このリポジトリには自己QAループ skill `qa-playtest` がある事を毎セッション知らせ、
# UI/フロー変更時に Claude が自発的に提案できるようにする。出力は additionalContext として読み込まれる。
cat <<'MSG'
[english_game / 自己QAループ] このリポジトリには skill `qa-playtest` がある。
js/ ・ style.css ・ index.html 等の UI/フロー/手触りに関わる変更をしたら、コミット前後に
「`/qa-playtest` で自己点検しますか?」と**ユーザーに提案**すること(自動プレイ→ディレクターペルソナ
×vision指摘→docs/qa に集約)。粒度・ペルソナ軸は docs/playtest-persona-director.md、手順は
.claude/skills/qa-playtest/。機械的な粗(配置・重なり・不意の音・テンポ)は人間に指摘させず自動で拾う方針。
MSG
