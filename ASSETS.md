# MCH Yoshka Guard v5 asset placement

手元で画像ファイルを以下のパスに配置してください。ファイルがない場合でも、ゲームは図形フォールバックで動きます。

## Heroes
- Image/Heroes/2005.png: グリム兄弟
- Image/Heroes/2003.png: ジャックザリッパー
- Image/Heroes/2002.png: スパルタクス
- Image/Heroes/2001.png: ライト兄弟

## Extensions / normal blessings
- Image/Extensions/2192.png: チャクラム
- Image/Extensions/2147.png: シールドシステム
- Image/Extensions/2187.png: ジャベリン
- Image/Extensions/2183.png: フレイル
- Image/Extensions/2121.png: 実はミサイル
- Image/Extensions/2098.png: ギョク
- Image/Extensions/2031.png: ブーツ
- Image/Extensions/2179.png: 籠罠
- Image/Extensions/2129.png: パンケーキ
- Image/Extensions/2010.png: シールド

## Extensions / evolutions
- Image/Extensions/5002.png: グランダルメ
- Image/Extensions/5035.png: バリスタ
- Image/Extensions/5143.png: 宇宙観測スフィア
- Image/Extensions/5147.png: アメノミナカヌシ

## Yoshka
- Image/Enemies/171.png: ヨシュカ
- Image/Enemies/172.png: ヨシュカ チョコラート

## Enemies
- Image/Enemies/101.png: クリーパー ショート
- Image/Enemies/102.png: クリーパー トール
- Image/Enemies/103.png: クリーパー グランデ
- Image/Enemies/104.png: クリーパー ヴェンティ
- Image/Enemies/105.png: クリーパー マキアート
- Image/Enemies/141.png: クリーパー トール ドッピオ
- Image/Enemies/143.png: クリーパー グランデ ドッピオ
- Image/Enemies/145.png: クリーパー ヴェンティ ドッピオ
- Image/Enemies/147.png: クリーパー フラペチーノ ドッピオ
- Image/Enemies/156.png: ハートブリード フラペチーノ ドッピオ

## Background
- Image/Backgrounds/1001.png

## Later
- Audio/BGM/: BGM
- Audio/SE/: 攻撃、被弾、CE取得、エクステンション取得、進化、勝利、敗北
- Data/Effects/GoldChest/: GitHubのGoldChestエフェクトを入れる予定の場所

## Current temporary mapping notes
通常敵5タイプ、鬼TIME敵5タイプともに指定済みです。


## v5.5 updates
- UI text unified from 加護 to エクステンション.
- Result screen gold chest button calls GoldChestModal.show() when files are present.
- Oni TIME excludes パンケーキ from extension choices and increases enemy pressure over time.

## Audio / v6.0
配置してください。

### BGM
- Audio/BGM/raid.mp3: 通常BGM。ゲーム開始から3分までループ再生。
- Audio/BGM/pvp.mp3: 鬼TIME BGM。鬼TIME突入時に再生。ループなし。
- Audio/BGM/win.mp3: 鬼TIME到達後のリザルトBGM。
- Audio/BGM/lose.mp3: 鬼TIME未到達時のリザルトBGM。

### SE
- Audio/SE/1_single_damage.mp3: ヨシュカ被ダメージ音。
- Audio/SE/3_heal_resurrection.mp3: CEがたまってエクステンション選択に入る音。
- Audio/SE/2_area_damage.mp3: 貫通・散弾・拡散系の発射音。サークル系は鳴らしません。

### Audio UI
- ゲーム中の「音量」ボタンからBGM音量、SE音量、ミュートを調整できます。
- 設定はlocalStorageに保存されます。
