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
```

アプリ内の設定パネルからAPIキーとモデルを保存することもできます。`.env.local` はGit管理対象外です。

### 3. Run the development server

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
