type SongPresetInput = {
  useCase: string;
  moods: string[];
  genres: string[];
  bpmMin: number;
  bpmMax: number;
  vocalType: string;
  vocalGender?: "m" | "f";
  instruments: string[];
  structure: string[];
  priorities: string[];
  avoid: string[];
  lyricLanguage: string;
  lyricTheme: string;
  lyricLength: string;
  instrumental: boolean;
  freeText: string;
};

type SongPreset = {
  value: string;
  label: string;
  input: SongPresetInput;
};

export const songPresetOptions: SongPreset[] = [
  {
    value: "songwriting",
    label: "楽曲制作",
    input: {
      useCase: "楽曲制作",
      moods: ["切ない", "爽やか", "夜", "ドライブ"],
      genres: ["ドリームポップ", "シンセウェーブ", "シンセポップ"],
      bpmMin: 90,
      bpmMax: 120,
      vocalType: "女性",
      vocalGender: "f",
      instruments: ["シンセパッド", "エレクトリックピアノ", "アルペジオシンセ", "ソフトベース"],
      structure: ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
      priorities: ["雰囲気重視", "キャッチー"],
      avoid: ["Heavy distortion", "Aggressive rap"],
      lyricLanguage: "日本語",
      lyricTheme: "夜、遠くへ行きたい気持ち",
      lyricLength: "標準",
      instrumental: false,
      freeText: "夜のドライブで聴きたい、少し切なくて爽やかなシンセポップ"
    }
  },
  {
    value: "demo",
    label: "デモ制作",
    input: {
      useCase: "デモ制作",
      moods: ["キャッチー", "爽やか", "青春感"],
      genres: ["ジェイポップ", "シンセポップ", "アコースティックポップ"],
      bpmMin: 96,
      bpmMax: 126,
      vocalType: "自動",
      instruments: ["ピアノ", "クリーンギター", "ソフトベース", "ドラムセット"],
      structure: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Outro"],
      priorities: ["キャッチー", "短く強い"],
      avoid: ["複雑すぎる展開", "長いイントロ"],
      lyricLanguage: "日本語",
      lyricTheme: "短時間で方向性が伝わる、覚えやすいフックのある歌詞",
      lyricLength: "短め",
      instrumental: false,
      freeText: "制作初期のデモ用に、方向性がすぐ伝わるキャッチーな曲"
    }
  },
  {
    value: "anime_opening",
    label: "アニメOP風",
    input: {
      useCase: "アニメOP風",
      moods: ["疾走感", "青春感", "勝利感", "熱血"],
      genres: ["アニソン", "アニメロック", "シンフォニックロック"],
      bpmMin: 150,
      bpmMax: 188,
      vocalType: "力強い",
      instruments: ["エレキギター", "歪みギター", "ストリングス", "ドラムセット", "シンセリード"],
      structure: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Outro"],
      priorities: ["キャッチー", "短く強い"],
      avoid: ["長いイントロ", "複雑すぎる展開"],
      lyricLanguage: "日本語",
      lyricTheme: "まだ見ぬ未来へ走り出す、仲間との決意と高揚感",
      lyricLength: "標準",
      instrumental: false,
      freeText: "90秒で強く印象に残る、疾走感のあるアニメOP風"
    }
  },
  {
    value: "anime_ending",
    label: "アニメED風",
    input: {
      useCase: "アニメED風",
      moods: ["儚い", "透明感", "切ない", "浮遊感"],
      genres: ["アニソン", "ピアノバラード", "ドリームポップ"],
      bpmMin: 72,
      bpmMax: 98,
      vocalType: "囁き声",
      instruments: ["ピアノ", "エレクトリックピアノ", "ストリングス", "オルゴール", "シンセパッド"],
      structure: ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
      priorities: ["歌詞重視", "雰囲気重視"],
      avoid: ["Heavy distortion", "Aggressive rap"],
      lyricLanguage: "日本語",
      lyricTheme: "一日の終わりに残る余韻、離れていても消えない記憶",
      lyricLength: "標準",
      instrumental: false,
      freeText: "余韻と透明感を重視した、少し切ないアニメED風"
    }
  },
  {
    value: "character_song",
    label: "キャラソン",
    input: {
      useCase: "キャラソン",
      moods: ["かわいい", "青春感", "高揚感"],
      genres: ["アイドルポップ", "アニソン", "カワイイフューチャーベース"],
      bpmMin: 124,
      bpmMax: 154,
      vocalType: "幼い",
      instruments: ["シンセリード", "ベル", "オルゴール", "ドラムセット", "ソフトベース"],
      structure: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Post-Chorus", "Outro"],
      priorities: ["キャッチー", "歌詞重視"],
      avoid: ["ダーク", "Heavy distortion"],
      lyricLanguage: "日本語",
      lyricTheme: "キャラクターの口癖や性格が伝わる、明るく覚えやすい歌詞",
      lyricLength: "標準",
      instrumental: false,
      freeText: "キャラクターらしさが前に出る、明るくかわいいキャラソン"
    }
  },
  {
    value: "vtuber_original",
    label: "VTuberオリ曲",
    input: {
      useCase: "VTuberオリ曲",
      moods: ["透明感", "サイバー", "かわいい", "高揚感"],
      genres: ["ハイパーポップ", "カワイイフューチャーベース", "イーディーエム", "アニソン"],
      bpmMin: 128,
      bpmMax: 168,
      vocalType: "Vocaloid風",
      instruments: ["シンセリード", "シンセパッド", "808ベース", "電子ドラム", "ベル"],
      structure: ["Intro", "Verse", "Build-up", "Drop", "Chorus", "Outro"],
      priorities: ["キャッチー", "踊れる"],
      avoid: ["長いイントロ", "複雑すぎる展開"],
      lyricLanguage: "日本語",
      lyricTheme: "配信画面から飛び出して世界へ届く、きらめきと自己紹介感",
      lyricLength: "標準",
      instrumental: false,
      freeText: "配信者の個性が出る、現代的でキラキラしたVTuberオリ曲"
    }
  },
  {
    value: "idol_song",
    label: "アイドル曲",
    input: {
      useCase: "アイドル曲",
      moods: ["かわいい", "勝利感", "青春感", "高揚感"],
      genres: ["アイドルポップ", "ジェイポップ", "カワイイフューチャーベース"],
      bpmMin: 126,
      bpmMax: 158,
      vocalType: "女性",
      vocalGender: "f",
      instruments: ["シンセリード", "ベル", "ドラムセット", "クリーンギター", "ソフトベース"],
      structure: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Post-Chorus", "Final Chorus", "Outro"],
      priorities: ["キャッチー", "踊れる"],
      avoid: ["Metal", "Heavy distortion"],
      lyricLanguage: "日本語",
      lyricTheme: "ステージで輝く瞬間、応援してくれる人へのまっすぐな感謝",
      lyricLength: "標準",
      instrumental: false,
      freeText: "ライブで盛り上がる、王道でキラキラしたアイドル曲"
    }
  },
  {
    value: "game_bgm",
    label: "ゲームBGM",
    input: {
      useCase: "ゲームBGM",
      moods: ["浮遊感", "神秘的", "冒険感", "透明感"],
      genres: ["オーケストラ", "シネマティック", "アートコア"],
      bpmMin: 88,
      bpmMax: 128,
      vocalType: "インスト",
      instruments: ["ストリングス", "フルート", "ハープ", "シンセパッド", "生パーカッション"],
      structure: ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
      priorities: ["雰囲気重視", "実験的"],
      avoid: ["Aggressive rap", "過度なオートチューン"],
      lyricLanguage: "日本語",
      lyricTheme: "探索中に自然にループできる、冒険と発見の空気",
      lyricLength: "短め",
      instrumental: true,
      freeText: "探索や拠点で流しやすい、ループ向きのゲームBGM"
    }
  },
  {
    value: "battle_theme",
    label: "戦闘BGM",
    input: {
      useCase: "戦闘BGM",
      moods: ["疾走感", "熱血", "勝利感", "不穏"],
      genres: ["シンフォニックロック", "オーケストラ", "ドラムンベース"],
      bpmMin: 150,
      bpmMax: 190,
      vocalType: "インスト",
      instruments: ["歪みギター", "オーケストラブラス", "ストリングス", "ドラムセット", "クワイア"],
      structure: ["Intro", "Verse", "Chorus", "Breakdown", "Final Chorus", "Outro"],
      priorities: ["短く強い", "雰囲気重視"],
      avoid: ["長いイントロ", "過度なオートチューン"],
      lyricLanguage: "日本語",
      lyricTheme: "通常戦闘を勢いよく押し上げる、反復しても飽きにくい緊張感",
      lyricLength: "短め",
      instrumental: true,
      freeText: "勢いと緊張感のある、ゲーム用の戦闘BGM"
    }
  },
  {
    value: "boss_theme",
    label: "ボス戦",
    input: {
      useCase: "ボス戦",
      moods: ["荘厳", "狂気", "不穏", "勝利感"],
      genres: ["オーケストラ", "ゴシックメタル", "シンフォニックロック"],
      bpmMin: 132,
      bpmMax: 176,
      vocalType: "コーラス多め",
      instruments: ["クワイア", "パイプオルガン", "オーケストラブラス", "歪みギター", "和太鼓"],
      structure: ["Intro", "Verse", "Chorus", "Breakdown", "Final Chorus", "Outro"],
      priorities: ["雰囲気重視", "実験的"],
      avoid: ["かわいい", "長いイントロ"],
      lyricLanguage: "日本語",
      lyricTheme: "圧倒的な敵と対峙する畏怖、最後の一撃へ向かう緊迫感",
      lyricLength: "短め",
      instrumental: false,
      freeText: "荘厳で危険な空気のある、ラスボス級のボス戦テーマ"
    }
  },
  {
    value: "stream_bgm",
    label: "配信用BGM",
    input: {
      useCase: "配信用BGM",
      moods: ["透明感", "静か", "かわいい", "浮遊感"],
      genres: ["ローファイ", "フューチャーベース", "シティポップ"],
      bpmMin: 82,
      bpmMax: 112,
      vocalType: "インスト",
      instruments: ["エレクトリックピアノ", "シンセパッド", "ソフトベース", "生パーカッション", "ベル"],
      structure: ["Intro", "Verse", "Chorus", "Outro"],
      priorities: ["雰囲気重視", "短く強い"],
      avoid: ["Heavy distortion", "Aggressive rap", "複雑すぎる展開"],
      lyricLanguage: "日本語",
      lyricTheme: "会話を邪魔しない、柔らかくループしやすい空気",
      lyricLength: "短め",
      instrumental: true,
      freeText: "雑談や作業配信に合う、邪魔にならない配信用BGM"
    }
  },
  {
    value: "sns_post",
    label: "SNS投稿",
    input: {
      useCase: "SNS投稿",
      moods: ["疾走感", "かわいい", "高揚感"],
      genres: ["ハイパーポップ", "イーディーエム", "ジェイポップ"],
      bpmMin: 132,
      bpmMax: 170,
      vocalType: "自動",
      instruments: ["シンセリード", "808ベース", "電子ドラム", "ベル"],
      structure: ["Intro", "Chorus", "Post-Chorus", "Outro"],
      priorities: ["短く強い", "キャッチー"],
      avoid: ["長いイントロ", "複雑すぎる展開"],
      lyricLanguage: "日本語",
      lyricTheme: "最初の数秒で耳に残る、短いフックと印象的な言葉",
      lyricLength: "短め",
      instrumental: false,
      freeText: "短尺動画で冒頭から引っかかる、強いフックのある曲"
    }
  },
  {
    value: "trailer",
    label: "トレーラー曲",
    input: {
      useCase: "トレーラー曲",
      moods: ["荘厳", "疾走感", "勝利感", "不穏"],
      genres: ["シネマティック", "オーケストラ", "シンフォニックロック"],
      bpmMin: 92,
      bpmMax: 140,
      vocalType: "コーラス多め",
      instruments: ["オーケストラブラス", "ストリングス", "クワイア", "和太鼓", "シンセベース"],
      structure: ["Intro", "Build-up", "Drop", "Breakdown", "Final Drop", "Outro"],
      priorities: ["短く強い", "雰囲気重視"],
      avoid: ["長いイントロ", "かわいい"],
      lyricLanguage: "日本語",
      lyricTheme: "映像のカットに合わせて期待感が上がる、壮大な導入と爆発",
      lyricLength: "短め",
      instrumental: false,
      freeText: "映像告知に使える、溜めと爆発のあるシネマティックな曲"
    }
  },
  {
    value: "commercial",
    label: "CM風",
    input: {
      useCase: "CM風",
      moods: ["爽やか", "かわいい", "高揚感"],
      genres: ["ジェイポップ", "シティポップ", "エレクトロスウィング"],
      bpmMin: 112,
      bpmMax: 148,
      vocalType: "女性",
      vocalGender: "f",
      instruments: ["クリーンギター", "エレクトリックピアノ", "ベル", "ドラムセット", "ソフトベース"],
      structure: ["Intro", "Chorus", "Post-Chorus", "Outro"],
      priorities: ["短く強い", "キャッチー"],
      avoid: ["ダーク", "複雑すぎる展開"],
      lyricLanguage: "日本語",
      lyricTheme: "商品名やキャッチコピーが自然に残る、明るく短いメッセージ",
      lyricLength: "短め",
      instrumental: false,
      freeText: "15秒から30秒で印象に残る、明るいCM風ジングル"
    }
  },
  {
    value: "video",
    label: "映像用",
    input: {
      useCase: "映像用",
      moods: ["透明感", "神秘的", "浮遊感", "静か"],
      genres: ["シネマティック", "ドリームポップ", "オーケストラ"],
      bpmMin: 70,
      bpmMax: 108,
      vocalType: "インスト",
      instruments: ["ピアノ", "ストリングス", "ハープ", "シンセパッド", "フルート"],
      structure: ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
      priorities: ["雰囲気重視", "歌詞重視"],
      avoid: ["Aggressive rap", "Heavy distortion"],
      lyricLanguage: "日本語",
      lyricTheme: "映像の余白を活かす、情景と感情の移り変わり",
      lyricLength: "短め",
      instrumental: true,
      freeText: "映像の邪魔をせず情緒を支える、透明感のある曲"
    }
  },
  {
    value: "emotional_ballad",
    label: "感情系バラード",
    input: {
      useCase: "感情系バラード",
      moods: ["切ない", "孤独感", "儚い", "透明感"],
      genres: ["ピアノバラード", "ジェイポップ", "ドリームポップ"],
      bpmMin: 62,
      bpmMax: 88,
      vocalType: "女性",
      vocalGender: "f",
      instruments: ["ピアノ", "ストリングス", "チェロ", "シンセパッド"],
      structure: ["Intro", "Verse", "Chorus", "Verse", "Chorus", "Bridge", "Final Chorus", "Outro"],
      priorities: ["歌詞重視", "雰囲気重視"],
      avoid: ["Aggressive rap", "Metal"],
      lyricLanguage: "日本語",
      lyricTheme: "言えなかった本音、過ぎた時間への後悔と小さな希望",
      lyricLength: "長め",
      instrumental: false,
      freeText: "感情の起伏を丁寧に出す、泣けるピアノバラード"
    }
  },
  {
    value: "other",
    label: "その他",
    input: {
      useCase: "その他",
      moods: ["幻想的", "透明感"],
      genres: ["ジェイポップ", "シネマティック", "シンセポップ"],
      bpmMin: 90,
      bpmMax: 130,
      vocalType: "自動",
      instruments: ["ピアノ", "シンセパッド", "クリーンギター", "ソフトベース"],
      structure: ["Intro", "Verse", "Chorus", "Bridge", "Outro"],
      priorities: ["雰囲気重視", "キャッチー"],
      avoid: ["複雑すぎる展開"],
      lyricLanguage: "日本語",
      lyricTheme: "自由なテーマ。狙いたい世界観や用途を追記してください。",
      lyricLength: "標準",
      instrumental: false,
      freeText: "自由入力を中心に、用途に合わせて調整する曲"
    }
  }
];

export const songUseCases = songPresetOptions.map(({ value, label }) => ({ value, label }));

export const useCaseOptions = songPresetOptions.map((option) => option.label);

export const moodOptions = [
  "疾走感",
  "高揚感",
  "勝利感",
  "熱血",
  "青春感",
  "冒険感",
  "爽やか",
  "キャッチー",
  "透明感",
  "浮遊感",
  "神秘的",
  "幻想的",
  "荘厳",
  "かわいい",
  "儚い",
  "切ない",
  "孤独感",
  "夜",
  "ドライブ",
  "静か",
  "不穏",
  "ダーク",
  "狂気",
  "退廃的",
  "サイバー",
  "和風"
];

export type OptionGroup = {
  id: string;
  label: string;
  options: string[];
};

export const genreOptionGroups: OptionGroup[] = [
  {
    id: "anime-game",
    label: "アニメ / ゲーム",
    options: [
      "アニソン",
      "アニメロック",
      "アニメポップ",
      "キャラソンポップ",
      "ゲームミュージック",
      "チップチューン",
      "戦闘曲",
      "ボス戦曲",
      "劇伴",
      "オープニング曲",
      "エンディング曲"
    ]
  },
  {
    id: "jpop-idol",
    label: "ポップ / アイドル",
    options: [
      "ジェイポップ",
      "シティポップ",
      "アイドルポップ",
      "ケーポップ",
      "歌謡ポップ",
      "渋谷系",
      "バンドポップ",
      "ピアノポップ",
      "アコースティックポップ",
      "バラード",
      "パワーバラード"
    ]
  },
  {
    id: "rock-metal",
    label: "ロック / メタル",
    options: [
      "ロック",
      "ポップロック",
      "ハードロック",
      "メタル",
      "ゴシックメタル",
      "シンフォニックロック",
      "オルタナティブロック",
      "パンクロック",
      "エモロック",
      "シューゲイザー",
      "ポストロック",
      "和ロック"
    ]
  },
  {
    id: "electronic",
    label: "電子音楽",
    options: [
      "イーディーエム",
      "ハウス",
      "テクノ",
      "トランス",
      "ダブステップ",
      "フューチャーベース",
      "カワイイフューチャーベース",
      "ハイパーポップ",
      "シンセポップ",
      "シンセウェーブ",
      "ドラムンベース",
      "ブレイクビーツ",
      "エレクトロスウィング",
      "ガバ",
      "アートコア"
    ]
  },
  {
    id: "hiphop-rnb",
    label: "ヒップホップ / ソウル",
    options: [
      "ヒップホップ",
      "トラップ",
      "ローファイヒップホップ",
      "リズムアンドブルース",
      "ネオソウル",
      "ファンク",
      "ディスコ",
      "ブームバップ",
      "チルホップ"
    ]
  },
  {
    id: "orchestral-cinematic",
    label: "オーケストラ / 劇伴",
    options: [
      "オーケストラ",
      "シネマティック",
      "エピック",
      "予告編音楽",
      "チェンバー",
      "合唱劇伴",
      "アンビエント劇伴",
      "ピアノバラード"
    ]
  },
  {
    id: "jazz-latin",
    label: "ジャズ / ラテン",
    options: [
      "ジャズ",
      "スウィング",
      "ボサノバ",
      "サンバ",
      "ラテンポップ",
      "タンゴ",
      "フュージョン",
      "ブルース"
    ]
  },
  {
    id: "world",
    label: "ワールド / 和風",
    options: [
      "和風ポップ",
      "和風劇伴",
      "民謡",
      "ケルト",
      "中華風",
      "中東風",
      "アフロビート",
      "レゲエ",
      "フォーク"
    ]
  },
  {
    id: "ambient",
    label: "アンビエント / 質感",
    options: [
      "アンビエント",
      "ドリームポップ",
      "ダークポップ",
      "ニューエイジ",
      "チルアウト",
      "環境音楽",
      "ミニマル",
      "退廃ポップ",
      "ローファイ"
    ]
  }
];

export const genreOptions = genreOptionGroups.flatMap((group) => group.options);

export const vocalOptions = [
  "インスト",
  "自動",
  "男性",
  "女性",
  "デュエット",
  "中性的",
  "Vocaloid風",
  "力強い",
  "幼い",
  "コーラス多め",
  "囁き声"
];

export const instrumentOptionGroups: OptionGroup[] = [
  {
    id: "keys",
    label: "鍵盤",
    options: [
      "ピアノ",
      "グランドピアノ",
      "アップライトピアノ",
      "エレクトリックピアノ",
      "エフエムエレピ",
      "オルガン",
      "ハモンドオルガン",
      "パイプオルガン",
      "ポルタティーフ・オルガン",
      "チェンバロ",
      "クラビネット",
      "メロトロン",
      "アコーディオン",
      "オルゴール",
      "チェレスタ",
      "グロッケンシュピール"
    ]
  },
  {
    id: "guitar-bass",
    label: "ギター / ベース",
    options: [
      "アコースティックギター",
      "クリーンギター",
      "エレキギター",
      "歪みギター",
      "リードギター",
      "リズムギター",
      "12弦ギター",
      "ナイロンギター",
      "ウクレレ",
      "マンドリン",
      "エレキベース",
      "ソフトベース",
      "シンセベース",
      "808ベース",
      "スラップベース",
      "アップライトベース",
      "アシッドベース"
    ]
  },
  {
    id: "drums",
    label: "ドラム / 打楽器",
    options: [
      "ドラムセット",
      "電子ドラム",
      "808ドラム",
      "キック",
      "スネア",
      "ハイハット",
      "シンバル",
      "タム",
      "クラップ",
      "スナップ",
      "シェイカー",
      "タンバリン",
      "コンガ",
      "ボンゴ",
      "ティンバレス",
      "カホン",
      "ティンパニ",
      "大太鼓",
      "サーミの太鼓",
      "生パーカッション",
      "ブレイクビーツ"
    ]
  },
  {
    id: "strings",
    label: "ストリングス",
    options: [
      "ストリングス",
      "バイオリン",
      "ビオラ",
      "チェロ",
      "コントラバス",
      "ピチカート",
      "トレモロストリングス",
      "ストリングススタッカート",
      "ハープ",
      "ニッケルハルパ",
      "ハーディ・ガーディ",
      "カンテレ",
      "グースリ",
      "ヨウヒッコ",
      "タルハルパ",
      "リラ",
      "ランゲレイク",
      "シネマティックストリングス"
    ]
  },
  {
    id: "winds",
    label: "管楽器",
    options: [
      "フルート",
      "ピッコロ",
      "クラリネット",
      "オーボエ",
      "ファゴット",
      "サックス",
      "トランペット",
      "トロンボーン",
      "ホルン",
      "チューバ",
      "オーケストラブラス",
      "ブラスセクション",
      "リコーダー",
      "骨笛",
      "角笛",
      "ルール",
      "セリエフロイテ",
      "ハーモニカ"
    ]
  },
  {
    id: "synth",
    label: "シンセ",
    options: [
      "シンセリード",
      "シンセパッド",
      "アルペジオシンセ",
      "プラックシンセ",
      "ベルシンセ",
      "ポリシンセ",
      "アナログシンセ",
      "デジタルシンセ",
      "ノイズシンセ",
      "シンセストリングス",
      "レーザーヒット",
      "ライザー",
      "ダウンリフター",
      "サブベース",
      "ワブルベース",
      "リースベース"
    ]
  },
  {
    id: "japanese",
    label: "和楽器",
    options: ["三味線", "琴", "尺八", "篠笛", "和太鼓", "鼓", "琵琶", "鈴", "拍子木"]
  },
  {
    id: "world",
    label: "民族楽器",
    options: [
      "二胡",
      "シタール",
      "タブラ",
      "ウード",
      "ダルブッカ",
      "バグパイプ",
      "口琴",
      "バンジョー",
      "フィドル",
      "カリンバ",
      "パンフルート",
      "ディジュリドゥ",
      "スティールパン",
      "ガムラン"
    ]
  },
  {
    id: "voice",
    label: "声 / 合唱",
    options: [
      "クワイア",
      "女声クワイア",
      "男声クワイア",
      "少年合唱",
      "ゴスペル合唱",
      "ボーカルチョップ",
      "ハミング",
      "囁き声",
      "掛け声",
      "群衆声",
      "ボコーダー"
    ]
  },
  {
    id: "textures",
    label: "効果音 / 質感",
    options: [
      "ベル",
      "鐘",
      "チャイム",
      "風鈴",
      "雨音",
      "波音",
      "風音",
      "街の環境音",
      "レコードノイズ",
      "テープノイズ",
      "グリッチ",
      "リバース音",
      "インパクト",
      "シネマヒット",
      "ホワイトノイズ",
      "金属音",
      "水音"
    ]
  }
];

export const instrumentOptions = instrumentOptionGroups.flatMap((group) => group.options);

export const structureOptions = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Post-Chorus",
  "Build-up",
  "Drop",
  "Breakdown",
  "Instrumental Solo",
  "Bridge",
  "Final Chorus",
  "Final Drop",
  "Outro"
];

export const structurePresets = [
  {
    id: "anime_op_short",
    label: "アニメOP風ショート",
    sections: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Outro"]
  },
  {
    id: "full_pop",
    label: "王道ポップス",
    sections: ["Intro", "Verse", "Pre-Chorus", "Chorus", "Verse", "Chorus", "Bridge", "Final Chorus", "Outro"]
  },
  {
    id: "edm_drop",
    label: "EDMドロップ型",
    sections: ["Intro", "Verse", "Build-up", "Drop", "Breakdown", "Final Drop", "Outro"]
  },
  {
    id: "ballad",
    label: "バラード型",
    sections: ["Intro", "Verse", "Chorus", "Verse", "Chorus", "Bridge", "Final Chorus", "Outro"]
  }
] as const;

export const priorityOptions = ["キャッチー", "歌詞重視", "雰囲気重視", "踊れる", "短く強い", "実験的"];

export const avoidOptions = [
  "Heavy distortion",
  "Aggressive rap",
  "Metal",
  "ダーク",
  "かわいい",
  "過度なオートチューン",
  "長いイントロ",
  "複雑すぎる展開"
];

export const defaultOpenRouterModel = "~openai/gpt-mini-latest";

export const openRouterModelOptions = [
  { provider: "OpenRouter", value: "openrouter/auto", label: "OpenRouter Auto" },
  { provider: "OpenRouter", value: "openrouter/fusion", label: "Fusion" },
  { provider: "OpenAI", value: "~openai/gpt-mini-latest", label: "GPT Mini Latest" },
  { provider: "OpenAI", value: "~openai/gpt-latest", label: "GPT Latest" },
  { provider: "OpenAI", value: "openai/gpt-chat-latest", label: "GPT Chat Latest" },
  { provider: "Anthropic", value: "~anthropic/claude-sonnet-latest", label: "Claude Sonnet Latest" },
  { provider: "Anthropic", value: "~anthropic/claude-haiku-latest", label: "Claude Haiku Latest" },
  { provider: "Anthropic", value: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8" },
  { provider: "Anthropic", value: "anthropic/claude-opus-4.8-fast", label: "Claude Opus 4.8 Fast" },
  { provider: "Google", value: "~google/gemini-flash-latest", label: "Gemini Flash Latest" },
  { provider: "Google", value: "~google/gemini-pro-latest", label: "Gemini Pro Latest" },
  { provider: "Google", value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { provider: "xAI", value: "x-ai/grok-4.3", label: "Grok 4.3" },
  { provider: "Qwen", value: "qwen/qwen3.7-plus", label: "Qwen3.7 Plus" },
  { provider: "Qwen", value: "qwen/qwen3.7-max", label: "Qwen3.7 Max" },
  { provider: "Mistral", value: "mistralai/mistral-medium-3-5", label: "Mistral Medium 3.5" },
  { provider: "MiniMax", value: "minimax/minimax-m3", label: "MiniMax M3" },
  { provider: "NVIDIA", value: "nvidia/nemotron-3-ultra-550b-a55b", label: "Nemotron 3 Ultra" },
  { provider: "Z.ai", value: "z-ai/glm-4.6", label: "GLM 4.6" }
] as const;
