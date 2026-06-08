# Suno Prompt Director

Suno Prompt Directorは、Suno向けの楽曲制作ディレクションを整理し、スタイルプロンプト、歌詞、ネガティブタグ、詳細設定、コピー用ブロックを生成するNext.jsアプリです。

## Features

- 用途、ムード、ジャンル、BPM、楽器、構成、歌詞テーマから方向性を提案
- 選択した方向性をもとにSuno用の最終プロンプトを生成
- Sunoのモデル別文字数制限に合わせた出力バリデーション
- OpenRouter APIキーとモデルをローカル設定として保存
- 生成履歴をブラウザ内に保存し、再利用や削除が可能

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- OpenRouter API
- Zod

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

`.env.local` にOpenRouter APIキーを設定してください。

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=~openai/gpt-mini-latest
OPENROUTER_SITE_URL=http://localhost:3000
# Optional: ffmpegがPATH外にある場合
FFMPEG_PATH=/path/to/ffmpeg
```

アプリ内の設定パネルからAPIキーとモデルを保存することもできます。`.env.local` はGit管理対象外です。

### 3. Set up local audio analysis

Reviseタブの音源解析は、Python + librosa を使うとBPM/キー/構成推定の精度が上がります。

```bash
npm run audio:setup
```

`ffmpeg` がPATHにない場合は、`.env.local` に `FFMPEG_PATH` を設定してください。
プロジェクト直下の `.venv/bin/ffmpeg` とHomebrewの標準的なインストール先は自動検出します。

Reviseタブの `高精度解析` は、利用できる場合に all-in-one と Demucs を追加で使います。
all-in-one は構成推定を補強し、Demucs は `drums / bass / vocals / other` などのstem比率で楽器推定を補強します。
解析用のstemやスペクトログラム等の中間ファイルは処理後に削除します。PyTorch/Demucs/all-in-oneのモデルキャッシュは再ダウンロードを避けるため削除しません。

高精度解析のPython候補は、`.env.local` の設定とプロジェクト直下の `.venv/bin/python` です。
all-in-oneやDemucsを別のPython環境に入れている場合は、必要に応じて `.env.local` に設定できます。
両方を同じ環境に入れている場合は、`AUDIO_ADVANCED_PYTHON` だけでも指定できます。

```env
AUDIO_ADVANCED_PYTHON=/path/to/python-with-audio-tools
ALLIN1_PYTHON=/path/to/python-with-allin1
DEMUCS_PYTHON=/path/to/python-with-demucs
AUDIO_ADVANCED_ALLIN1_MODEL=harmonix-fold0
AUDIO_ADVANCED_DEMUCS_MODEL=htdemucs
```

### 4. Run the development server

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
```

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE) for details.
