# SETUP.md 窶・譁ｰPC繧ｻ繝・ヨ繧｢繝・・謇矩・

縺薙・繝峨く繝･繝｡繝ｳ繝医・譁ｰ縺励＞PC・医ず繝PC繝ｻ閾ｪ螳・C繝ｻ繝弱・繝・C・峨〒縺薙・繝ｯ繝ｼ繧ｯ繧ｹ繝壹・繧ｹ繧剃ｽｿ縺・ｧ九ａ繧九◆繧√・謇矩・嶌縺ｧ縺吶・
Codex / Claude Code 縺ｮ縺ｩ縺｡繧峨ｒ菴ｿ縺・ｴ蜷医ｂ縲√％縺ｮ謇矩・ｒ蜈ｱ騾壹〒菴ｿ縺・∪縺吶・

---

## 蜑肴署繝ｻ豕ｨ諢丈ｺ矩・

- **OneDrive邂｡逅・ｸ九・繝輔か繝ｫ繝縺ｫ繧ｯ繝ｭ繝ｼ繝ｳ縺励↑縺・*・亥酔譛溽ｫｶ蜷医ｄ繝輔ぃ繧､繝ｫ繝ｭ繝・け縺檎匱逕溘☆繧具ｼ・
- 菴懈･ｭ繝輔か繝ｫ繝縺ｯ `C:\hirayama-ai-workspace\` 蝗ｺ螳壹〒菴ｿ縺・
- GitHub 繧呈ｭ｣譛ｬ縺ｨ縺励√Ο繝ｼ繧ｫ繝ｫ縺ｮ譛ｪpush迥ｶ諷九ｒ蝓ｺ貅悶↓縺励↑縺・
- 隱崎ｨｼ諠・ｱ繝輔ぃ繧､繝ｫ・・service_account.json`縲～.env` 遲会ｼ峨・Git縺ｫ蜷ｫ縺ｾ繧後※縺・↑縺・◆繧∝挨騾秘・鄂ｮ縺悟ｿ・ｦ・
- PC蝗ｺ譛峨ヵ繧｡繧､繝ｫ縺ｯ GitHub 縺ｫ荳翫￡縺ｪ縺・

---

## Step 1 窶・繝・・繝ｫ縺ｮ繧､繝ｳ繧ｹ繝医・繝ｫ

莉･荳九ｒ鬆・分縺ｫ繧､繝ｳ繧ｹ繝医・繝ｫ縺吶ｋ縲ゅう繝ｳ繧ｹ繝医・繝ｫ蠕後・譁ｰ縺励＞繧ｿ繝ｼ繝溘リ繝ｫ繧帝幕縺・※繝代せ繧貞渚譏縺輔○繧九・

### Git

蜈ｬ蠑上し繧､繝医°繧峨う繝ｳ繧ｹ繝医・繝ｫ・・indows逕ｨ繧､繝ｳ繧ｹ繝医・繝ｩ繝ｼ・・
```
https://git-scm.com/download/win
```

遒ｺ隱・
```bash
git --version
# git version 2.x.x
```

### Node.js・・lasp逕ｨ・・

LTS迚医ｒ繧､繝ｳ繧ｹ繝医・繝ｫ:
```
https://nodejs.org/
```

### clasp・・AS逕ｨCLI繝・・繝ｫ・・

```bash
npm install -g @google/clasp
```

### Python・・atient-management逕ｨ・・

3.11莉･荳翫ｒ繧､繝ｳ繧ｹ繝医・繝ｫ:
```
https://www.python.org/downloads/
```

繧､繝ｳ繧ｹ繝医・繝ｫ譎ゅ↓縲窟dd Python to PATH縲阪↓繝√ぉ繝・け繧貞・繧後ｋ縲・

---

## Step 2 窶・繝ｪ繝昴ず繝医Μ縺ｮ繧ｯ繝ｭ繝ｼ繝ｳ

Git Bash 縺ｾ縺溘・ PowerShell 縺ｧ螳溯｡・

```bash
mkdir -p /c/hirayama-ai-workspace
cd /c/hirayama-ai-workspace
git clone https://github.com/dabu-pi/hirayama-ai-workspace.git workspace
```

繧ｯ繝ｭ繝ｼ繝ｳ蠕後・讒矩:

```
C:\hirayama-ai-workspace\
笏披楳笏 workspace\   竊・縺薙％縺梧悽逡ｪ髢狗匱繝・ぅ繝ｬ繧ｯ繝医Μ
```

---

## Step 3 窶・Git縺ｮ蛻晄悄險ｭ螳夲ｼ域眠PC縺ｧ蛻晏屓縺ｮ縺ｿ・・

```bash
git config --global user.name "Katsushi Hirayama"
git config --global user.email "縺薙％縺ｫ閾ｪ蛻・・GitHub繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ繧貞・蜉・
# 萓・ git config --global user.email "dabu-pi@users.noreply.github.com"
```

險ｭ螳夂｢ｺ隱・

```bash
git config --global --list
# user.name=Katsushi Hirayama
# user.email=...
```

繝ｪ繝｢繝ｼ繝育｢ｺ隱・

```bash
cd /c/hirayama-ai-workspace/workspace
git remote -v
# origin https://github.com/dabu-pi/hirayama-ai-workspace.git
```

---

## Step 4 窶・繝励Ο繧ｸ繧ｧ繧ｯ繝亥挨縺ｮ蛻晄悄險ｭ螳・

### 4-1. 譟疲紛GAS / freee閾ｪ蜍募喧・・AS繝励Ο繧ｸ繧ｧ繧ｯ繝茨ｼ・

clasp縺ｮGoogle隱崎ｨｼ:

```bash
clasp login
```

繝悶Λ繧ｦ繧ｶ縺碁幕縺上・縺ｧGoogle繧｢繧ｫ繧ｦ繝ｳ繝医〒繝ｭ繧ｰ繧､繝ｳ縺励※隱崎ｨｼ繧貞ｮ御ｺ・＆縺帙ｋ縲・

隱崎ｨｼ遒ｺ隱・

```bash
clasp whoami
# Logged in as: xxxx@gmail.com
```

蜷ЖAS繝励Ο繧ｸ繧ｧ繧ｯ繝医・ `.clasp.json` 縺ｯ **git縺ｫ蜷ｫ縺ｾ繧後※縺・↑縺・*・・C蝗ｺ譛芽ｨｭ螳夲ｼ峨・
繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝医・繧ｨ繝・ぅ繧ｿ縺ｧ縲梧僑蠑ｵ讖溯・ 竊・Apps Script縲阪ｒ髢九″縲√せ繧ｯ繝ｪ繝励ヨID繧堤｢ｺ隱阪＠縺ｦ菴懈・縺吶ｋ縲・

```bash
cd /c/hirayama-ai-workspace/workspace/gas-projects/jyu-gas-ver3.1
```

`.clasp.json`・亥推閾ｪ菴懈・繝ｻ繧ｳ繝溘ャ繝井ｸ榊庄・・

```json
{
  "scriptId": "縺薙％縺ｫ繧ｹ繧ｯ繝ｪ繝励ヨID繧定ｲｼ繧・,
  "rootDir": "."
}
```

### 4-2. patient-management・・lask Web繧｢繝励Μ・・

```bash
cd /c/hirayama-ai-workspace/workspace/patient-management
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

`service_account.json` 繧帝・鄂ｮ縺吶ｋ・・it縺ｫ蜷ｫ縺ｾ繧後※縺・↑縺・◆繧∝挨騾泌・謇具ｼ・

```
C:\hirayama-ai-workspace\workspace\patient-management\service_account.json
```

`.env` 繝輔ぃ繧､繝ｫ繧剃ｽ懈・・・it縺ｫ蜷ｫ縺ｾ繧後※縺・↑縺・◆繧∬・蛻・〒菴懈・・・

```
GOOGLE_SERVICE_ACCOUNT_PATH=service_account.json
FLASK_SECRET_KEY=莉ｻ諢上・繝ｩ繝ｳ繝繝譁・ｭ怜・
```

襍ｷ蜍慕｢ｺ隱・

```bash
python app.py
# 竊・繝悶Λ繧ｦ繧ｶ縺ｧ http://localhost:5000 縺ｫ繧｢繧ｯ繧ｻ繧ｹ縺励※蜍穂ｽ懃｢ｺ隱・
```

---

## Step 5 窶・PowerShell 繧ｨ繧､繝ｪ繧｢繧ｹ縺ｮ險ｭ螳・

PowerShell 縺ｧ繧ｷ繝ｧ繝ｼ繝医さ繝槭Φ繝峨ｒ菴ｿ縺医ｋ繧医≧縺ｫ縺励∪縺吶・
Git Bash 縺ｧ縺ｪ縺・**PowerShell (5.1 縺ｾ縺溘・ 7)** 縺ｧ螳溯｡後＠縺ｦ縺上□縺輔＞縲・

### 5-1. 螳溯｡後・繝ｪ繧ｷ繝ｼ縺ｮ螟画峩・亥・蝗槭・縺ｿ・・

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 5-2. 繧ｨ繧､繝ｪ繧｢繧ｹ縺ｮ閾ｪ蜍慕匳骭ｲ

```powershell
cd C:\hirayama-ai-workspace\workspace\scripts
.\setup-aliases.ps1
```

遒ｺ隱阪□縺代＠縺溘＞蝣ｴ蜷茨ｼ・ryRun・・

```powershell
.\setup-aliases.ps1 -DryRun
```

### 5-3. $PROFILE 縺ｮ蜊ｳ譎ょ渚譏

```powershell
. $PROFILE
```

譁ｰ縺励＞繧ｿ繝ｼ繝溘リ繝ｫ繧帝幕縺・※繧り・蜍輔〒蜿肴丐縺輔ｌ縺ｾ縺吶・

### 逋ｻ骭ｲ縺輔ｌ繧九さ繝槭Φ繝・

| 繧ｳ繝槭Φ繝・| 蠖ｹ蜑ｲ | 繝輔ぉ繝ｼ繧ｺ |
|---|---|---|
| `ds` | 菴懈･ｭ髢句ｧ具ｼ喩it pull + 迥ｶ諷狗｢ｺ隱・| **Phase3** |
| `de` | 菴懈･ｭ邨ゆｺ・ｼ喞ommit + push | **Phase3** |
| `cap` | 譁ｰ隕上・繝ｭ繧ｸ繧ｧ繧ｯ繝井ｽ懈・ | Phase1 |
| `rwl` | 繝ｭ繧ｰ莉倥″螳溯｡鯉ｼ育峩謗･・・| Phase1 |
| `note` | 髢狗匱繝｡繝｢菫晏ｭ・| Phase1 |
| `adr` | 蜿ｸ莉､蝪費ｼ嗷wl 邨檎罰螳溯｡・+ 閾ｪ蜍・note | Phase2 |
| `gsc` | 螳牙・遒ｺ隱堺ｻ倥″ commit & push | Phase2 |
| `aerr` | 譛譁ｰ繧ｨ繝ｩ繝ｼ繝ｭ繧ｰ謨ｴ蠖｢陦ｨ遉ｺ | Phase2 |
| `dstat` | 繝励Ο繧ｸ繧ｧ繧ｯ繝育憾諷九ム繝・す繝･繝懊・繝・| Phase2 |

蜍穂ｽ懃｢ｺ隱・

```powershell
ds            # 譛譁ｰ繧ｳ繝ｼ繝峨ｒ蜿門ｾ・
dstat         # 繝励Ο繧ｸ繧ｧ繧ｯ繝育憾諷九ｒ陦ｨ遉ｺ
note "繧ｻ繝・ヨ繧｢繝・・螳御ｺ・ -Tag done
```

---

## Step 6 窶・Claude Code 繝代・繝溘ャ繧ｷ繝ｧ繝ｳ險ｭ螳夲ｼ・蜿ｰ蜈ｱ騾壹・蠢・茨ｼ・

`git push` / `clasp push` 縺ｮ遒ｺ隱阪ム繧､繧｢繝ｭ繧ｰ繧堤怐逡･縺吶ｋ縺溘ａ縲√Θ繝ｼ繧ｶ繝ｼ蜈ｱ騾夊ｨｭ螳壹ｒ菴懈・縺吶ｋ縲・

```powershell
# 繝輔ぃ繧､繝ｫ縺悟ｭ伜惠縺励↑縺・ｴ蜷医・譁ｰ隕丈ｽ懈・縲∝ｭ伜惠縺吶ｋ蝣ｴ蜷医・蜀・ｮｹ繧堤｢ｺ隱阪＠縺ｦ霑ｽ險・
notepad $env:USERPROFILE\.claude\settings.json
```

莉･荳九・蜀・ｮｹ繧定ｨｭ螳壹☆繧具ｼ域里蟄倥・ `allow` 驟榊・縺後≠繧句ｴ蜷医・2陦後ｒ霑ｽ險倥☆繧具ｼ・

```json
{
  "permissions": {
    "allow": [
      "Bash(git push:*)",
      "Bash(clasp push:*)"
    ]
  }
}
```

> **豕ｨ諢・** `~/.claude/settings.json` 縺ｯ繝ｪ繝昴ず繝医Μ縺ｫ蜷ｫ縺ｾ繧後↑縺・・蜿ｰ縺ｮPC・磯劼PC繝ｻ閾ｪ螳・C繝ｻ繝弱・繝・C・峨◎繧後◇繧後〒謇句虚菴懈・縺悟ｿ・ｦ√・

遒ｺ隱・
```powershell
cat $env:USERPROFILE\.claude\settings.json
```

---

## Step 7 窶・Codex / Claude 蜈ｱ騾壹・襍ｷ蜍輔Ν繝ｼ繝ｫ

AI 縺ｫ菴懈･ｭ繧剃ｾ晞ｼ縺吶ｋ蜑阪↓縲∵ｬ｡繧堤｢ｺ隱阪☆繧九・

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull
```

AI 縺ｫ縺ｯ縲√∪縺壽ｬ｡繧定ｪｭ繧繧医≧縺ｫ謖・､ｺ縺吶ｋ縲・

1. `README.md`
2. `PROJECTS.md`
3. `ROADMAP.md`
4. `docs/PROJECT_STATUS.md`
5. 蟇ｾ雎｡繝励Ο繧ｸ繧ｧ繧ｯ繝医・ `README.md`
6. 蟇ｾ雎｡繝励Ο繧ｸ繧ｧ繧ｯ繝医・ `PROJECT_STATUS.md`
7. 蠢・ｦ√↓蠢懊§縺ｦ `spec.md` / `SPEC.md`

螳壼梛謖・､ｺ萓・

```text
縺ｾ縺・README.md縲￣ROJECTS.md縲ヽOADMAP.md縲‥ocs/PROJECT_STATUS.md 縺ｨ縲・
莉雁屓隗ｦ繧九・繝ｭ繧ｸ繧ｧ繧ｯ繝医・ README / PROJECT_STATUS / spec 繧定ｪｭ繧薙〒縺九ｉ菴懈･ｭ縺励※縺上□縺輔＞縲・
菴懈･ｭ蜑阪↓ git status 繧堤｢ｺ隱阪＠縲∵怙蠕後↓螟画峩轤ｹ繝ｻ讀懆ｨｼ邨先棡繝ｻ谺｡縺ｮ菴懈･ｭ繧呈紛逅・＠縺ｦ縺上□縺輔＞縲・
```

---

## Step 7 窶・3蜿ｰ縺ｮPC繧貞・繧頑崛縺医ｋ譌･蟶ｸ驕狗畑

### 7-1. 菴懈･ｭ髢句ｧ区凾

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull
```

遒ｺ隱阪・繧､繝ｳ繝・

- 莉翫・PC縺ｫ譛ｪ繧ｳ繝溘ャ繝亥ｷｮ蛻・′谿九▲縺ｦ縺・↑縺・°
- 蛻･PC縺ｧ push 貂医∩縺ｮ螟画峩繧貞叙蠕励〒縺阪◆縺・
- 蟇ｾ雎｡繝励Ο繧ｸ繧ｧ繧ｯ繝医・ `PROJECT_STATUS.md` 繧定ｪｭ繧薙□縺・

### 7-2. 菴懈･ｭ邨ゆｺ・凾

譛菴朱剞縲∵ｬ｡繧偵ｄ繧九・

- `PROJECT_STATUS.md` 縺ｾ縺溘・髢｢騾｣繝｡繝｢繧呈峩譁ｰ縺吶ｋ
- 蠢・ｦ√↑繝・せ繝医・遒ｺ隱阪ｒ螳溯｡後☆繧・
- `git status` 縺ｧ蟾ｮ蛻・ｒ遒ｺ隱阪☆繧・
- `git add` 竊・`git commit` 竊・`git push`

萓・

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git add .
git commit -m "docs: update project status"
git push origin feature/auto-dev-phase3-loop
```

### 7-3. PC 繧貞・繧頑崛縺医ｋ蜑阪・遖∵ｭ｢莠矩・

- push 蜑阪・螟画峩繧呈ｮ九＠縺溘∪縺ｾ莉悶・PC縺ｧ邯壹″繧貞ｧ九ａ縺ｪ縺・
- AI縺ｨ縺ｮ莨夊ｩｱ縺縺代↓驥崎ｦ∝愛譁ｭ繧呈ｮ九＆縺ｪ縺・
- 蜷後§繝輔ぃ繧､繝ｫ繧定､・焚PC縺ｧ蜷梧凾縺ｫ邱ｨ髮・＠縺ｪ縺・
- `.env` 繧・`service_account.json` 繧偵さ繝溘ャ繝医＠縺ｪ縺・

---

## Step 8 窶・蜍穂ｽ懃｢ｺ隱阪メ繧ｧ繝・け繝ｪ繧ｹ繝・

| 鬆・岼 | 遒ｺ隱阪さ繝槭Φ繝・| 譛溷ｾ・ｵ先棡 |
|---|---|---|
| Git | `git status` | 繝悶Λ繝ｳ繝∝錐縺ｨ菴懈･ｭ迥ｶ諷九′陦ｨ遉ｺ縺輔ｌ繧・|
| Git險ｭ螳・| `git config --global --list` | name / email 縺瑚｡ｨ遉ｺ縺輔ｌ繧・|
| GitHub繝ｪ繝｢繝ｼ繝・| `git remote -v` | `origin` 縺・`dabu-pi/hirayama-ai-workspace.git` 繧呈欠縺・|
| clasp隱崎ｨｼ | `clasp whoami` | Google繧｢繧ｫ繧ｦ繝ｳ繝医・繝｡繝ｼ繝ｫ縺瑚｡ｨ遉ｺ縺輔ｌ繧・|
| Python莉ｮ諠ｳ迺ｰ蠅・| `python --version`・・env蜀・ｼ・| 3.11莉･荳・|
| Flask繧｢繝励Μ | `python app.py` | localhost:5000 縺ｧ繧｢繧ｯ繧ｻ繧ｹ蜿ｯ閭ｽ |
| 繧ｨ繧､繝ｪ繧｢繧ｹ・・S・嬰s | `ds` | git pull + 迥ｶ諷玖｡ｨ遉ｺ縺悟・繧・|
| 繧ｨ繧､繝ｪ繧｢繧ｹ・・S・嬰e | `de "繝・せ繝・` | 繧ｳ繝溘ャ繝医・push 螳御ｺ・→陦ｨ遉ｺ縺輔ｌ繧・|
| 繧ｨ繧､繝ｪ繧｢繧ｹ・・S・・| `dstat` | 繝励Ο繧ｸ繧ｧ繧ｯ繝育憾諷九′陦ｨ遉ｺ縺輔ｌ繧・|
| 繧ｨ繧､繝ｪ繧｢繧ｹ・・S・・| `note "test" -Tag done` | logs/notes/ 縺ｫ繝｡繝｢縺御ｿ晏ｭ倥＆繧後ｋ |
| env vars・・IOS・・| `$env:AIOS_DASHBOARD_SPREADSHEET_ID` | 繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝・D縺瑚｡ｨ遉ｺ縺輔ｌ繧具ｼ・tep 9蜿ら・・・|

---

## 繝医Λ繝悶Ν繧ｷ繝･繝ｼ繝・ぅ繝ｳ繧ｰ

### `clasp login` 縺ｧ繝悶Λ繧ｦ繧ｶ縺碁幕縺九↑縺・

```bash
clasp login --no-localhost
```

陦ｨ遉ｺ縺輔ｌ縺欟RL繧偵ヶ繝ｩ繧ｦ繧ｶ縺ｧ謇句虚縺ｧ髢九＞縺ｦ隱崎ｨｼ縺吶ｋ縲・

### `git pull` 縺ｧ繧ｳ繝ｳ繝輔Μ繧ｯ繝医′逋ｺ逕溘＠縺・

```bash
git status                     # 繧ｳ繝ｳ繝輔Μ繧ｯ繝亥ｯｾ雎｡繝輔ぃ繧､繝ｫ繧堤｢ｺ隱・
# 繝輔ぃ繧､繝ｫ繧呈焔蜍輔〒邱ｨ髮・＠縺ｦ繧ｳ繝ｳ繝輔Μ繧ｯ繝医ｒ隗｣豸・
git add <繝輔ぃ繧､繝ｫ蜷・
git commit -m "Resolve merge conflict"
```

### `service_account.json` 縺瑚ｦ九▽縺九ｉ縺ｪ縺・お繝ｩ繝ｼ

`patient-management/` 縺ｫ `service_account.json` 縺碁・鄂ｮ縺輔ｌ縺ｦ縺・ｋ縺狗｢ｺ隱阪☆繧九・
git縺ｫ縺ｯ蜷ｫ縺ｾ繧後※縺・↑縺・◆繧√∝挨縺ｮPC縺九ｉ逶ｴ謗･繧ｳ繝斐・縺吶ｋ縺九；oogle Cloud Console縺ｧ蜀咲匱陦後☆繧九・

### Python莉ｮ諠ｳ迺ｰ蠅・′隕九▽縺九ｉ縺ｪ縺・/ activate 縺ｧ縺阪↑縺・

```bash
cd /c/hirayama-ai-workspace/workspace/patient-management
python -m venv venv          # 蜀堺ｽ懈・
source venv/Scripts/activate
pip install -r requirements.txt
```

---

## 髢｢騾｣繝峨く繝･繝｡繝ｳ繝・

- `AGENTS.md`
- `docs/CODEX_MIGRATION_CHECKLIST.md`
- `CLAUDE.md`
- `docs/AI_DEV_ENV.md`

## Step 9 窶・de 繧ｳ繝槭Φ繝臥畑 env vars 縺ｮ險ｭ螳夲ｼ・IOS Dashboard 騾｣謳ｺ・・

### 菴輔・縺溘ａ縺ｮ險ｭ螳壹°

`de` 繧ｳ繝槭Φ繝峨・ workspace 蜈ｨ繝励Ο繧ｸ繧ｧ繧ｯ繝亥・騾壹・菴懈･ｭ邨ゆｺ・さ繝槭Φ繝峨〒縺吶・
莉･荳九・迺ｰ蠅・､画焚縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺ｨ縲～de` 1繧ｳ繝槭Φ繝峨〒谺｡縺ｮ蜃ｦ逅・∪縺ｧ閾ｪ蜍募ｮ溯｡後＆繧後∪縺呻ｼ・

```
commit 竊・push 竊・Run_Log 繧ｷ繝ｼ繝郁ｿｽ險・竊・Projects 譛蟆丞酔譛滂ｼ域ｬ｡繧｢繧ｯ繧ｷ繝ｧ繝ｳ / 譛邨よ峩譁ｰ譌･ / 陬懆ｶｳ・・
```

**譛ｪ險ｭ螳壹・蝣ｴ蜷・** commit / push / 繝ｭ繝ｼ繧ｫ繝ｫ Run_Log JSON 蜃ｺ蜉帙・騾壼ｸｸ騾壹ｊ蜍穂ｽ懊＠縺ｾ縺吶・
Run_Log 繧ｷ繝ｼ繝郁ｿｽ險倥→ Projects 蜷梧悄縺ｮ縺ｿ繧ｹ繧ｭ繝・・縺輔ｌ縺ｾ縺呻ｼ医お繝ｩ繝ｼ縺ｫ縺ｯ縺ｪ繧翫∪縺帙ｓ・峨・

### 蠢・ｦ√↑ 2 縺､縺ｮ迺ｰ蠅・､画焚

| 螟画焚蜷・| 蜀・ｮｹ |
|---|---|
| `AIOS_DASHBOARD_SPREADSHEET_ID` | Hirayama AI OS Dashboard 縺ｮ繧ｹ繝励Ξ繝・ラ繧ｷ繝ｼ繝・D・・1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk`・・|
| `AIOS_SERVICE_ACCOUNT_PATH` | 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝・JSON 縺ｮ邨ｶ蟇ｾ繝代せ・井ｾ・ `C:\hirayama-ai-workspace\secrets\aios-service-account.json`・・|

繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝・JSON 縺ｯ Git 縺ｫ蜷ｫ縺ｾ繧後※縺・∪縺帙ｓ縲ょ挨縺ｮPC縺九ｉ繧ｳ繝斐・縺吶ｋ縺九；oogle Cloud Console 縺ｧ蜀咲匱陦後＠縺ｦ驟咲ｽｮ縺励※縺上□縺輔＞縲・

**驟咲ｽｮ蜈茨ｼ域ｭ｣譛ｬ・・** `C:\hirayama-ai-workspace\secrets\aios-service-account.json`

> `workspace\` 縺ｮ螟厄ｼ・secrets\`・峨↓鄂ｮ縺冗炊逕ｱ: 隱崎ｨｼ諠・ｱ繧・Git 邂｡逅・ｯｾ雎｡螟悶↓縺吶ｋ縺溘ａ縲・
> `patient-management\service_account.json` 縺ｨ縺ｯ蛻･繝輔ぃ繧､繝ｫ縺ｧ縺呻ｼ育畑騾斐・讓ｩ髯舌′逡ｰ縺ｪ繧具ｼ峨・

### 險ｭ螳壽婿豕包ｼ・owerShell・・

#### 繧ｻ繝・す繝ｧ繝ｳ蜀・□縺第怏蜉ｹ縺ｫ縺吶ｋ・亥虚菴懃｢ｺ隱阪・荳譎りｨｭ螳夲ｼ・

PowerShell 繧帝幕縺・※螳溯｡後ゅち繝ｼ繝溘リ繝ｫ繧帝哩縺倥ｋ縺ｨ豸医∴繧九・

```powershell
$env:AIOS_DASHBOARD_SPREADSHEET_ID = '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk'
$env:AIOS_SERVICE_ACCOUNT_PATH     = 'C:\hirayama-ai-workspace\secrets\aios-service-account.json'
```

#### 諱剃ｹ・ｨｭ螳夲ｼ・C 蜀崎ｵｷ蜍募ｾ後ｂ譛牙柑繝ｻ謗ｨ螂ｨ・・

PowerShell 繧・**邂｡逅・・↑縺励〒螳溯｡・* 縺励※繧ゅΘ繝ｼ繧ｶ繝ｼ遽・峇・・User` 繧ｹ繧ｳ繝ｼ繝暦ｼ峨〒逋ｻ骭ｲ縺ｧ縺阪∪縺吶・
險ｭ螳壼ｾ後・譁ｰ縺励＞繧ｿ繝ｼ繝溘リ繝ｫ繧帝幕縺・※蜿肴丐縺輔○縺ｦ縺上□縺輔＞縲・

```powershell
[Environment]::SetEnvironmentVariable('AIOS_DASHBOARD_SPREADSHEET_ID', '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk', 'User')
[Environment]::SetEnvironmentVariable('AIOS_SERVICE_ACCOUNT_PATH', 'C:\hirayama-ai-workspace\secrets\aios-service-account.json', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_NAME', 'Run_Log', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_WRITE', '1', 'User')
```

> `AIOS_RUNLOG_SHEET_NAME` / `AIOS_RUNLOG_SHEET_WRITE` 縺ｯ陬懷勧螟画焚縲りｨｭ螳壹＠縺ｪ縺上※繧ゅせ繝励Ξ繝・ラ繧ｷ繝ｼ繝・D縺ｨ繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医′縺ゅｌ縺ｰ蜍穂ｽ懊＠縺ｾ縺吶・

### 險ｭ螳壼ｾ後・遒ｺ隱阪さ繝槭Φ繝・

```powershell
# 螟画焚縺瑚ｨｭ螳壹＆繧後※縺・ｋ縺狗｢ｺ隱・
$env:AIOS_DASHBOARD_SPREADSHEET_ID
$env:AIOS_SERVICE_ACCOUNT_PATH

# 繧ｵ繝ｼ繝薙せ繧｢繧ｫ繧ｦ繝ｳ繝医ヵ繧｡繧､繝ｫ縺悟ｭ伜惠縺吶ｋ縺狗｢ｺ隱・
Test-Path $env:AIOS_SERVICE_ACCOUNT_PATH
# 竊・True 縺瑚ｿ斐ｌ縺ｰ OK
```

### 蛻･PC 繧ｻ繝・ヨ繧｢繝・・譎ゅ・遒ｺ隱阪メ繧ｧ繝・け

1. `aios-service-account.json` 繧・`C:\hirayama-ai-workspace\secrets\` 縺ｫ驟咲ｽｮ縺励◆縺・
2. `AIOS_DASHBOARD_SPREADSHEET_ID` 繧呈￡荵・ｨｭ螳壹＠縺溘°・井ｸ願ｨ倥さ繝槭Φ繝牙盾辣ｧ・・
3. `AIOS_SERVICE_ACCOUNT_PATH` 繧呈￡荵・ｨｭ螳壹＠縺溘°
4. 譁ｰ縺励＞繧ｿ繝ｼ繝溘リ繝ｫ繧帝幕縺・※ `$env:AIOS_DASHBOARD_SPREADSHEET_ID` 繧堤｢ｺ隱阪＠縺溘°
5. `de -ProjectId AIOS-06 "繧ｻ繝・ヨ繧｢繝・・遒ｺ隱・` 繧貞ｮ溯｡後＠ Run_Log 繧ｷ繝ｼ繝医↓陦後′霑ｽ險倥＆繧後◆縺・

### 譛ｪ險ｭ螳壽凾縺ｮ謖吝虚縺ｾ縺ｨ繧・

| 繧ｹ繝・ャ繝・| env vars 險ｭ螳壽ｸ医∩ | env vars 譛ｪ險ｭ螳・|
|---|---|---|
| commit / push | 笨・騾壼ｸｸ騾壹ｊ | 笨・騾壼ｸｸ騾壹ｊ |
| 繝ｭ繝ｼ繧ｫ繝ｫ Run_Log JSON 蜃ｺ蜉・| 笨・騾壼ｸｸ騾壹ｊ | 笨・騾壼ｸｸ騾壹ｊ |
| Run_Log 繧ｷ繝ｼ繝郁ｿｽ險・| 笨・閾ｪ蜍募ｮ溯｡・| 笞・・繧ｹ繧ｭ繝・・・医お繝ｩ繝ｼ縺ｪ縺暦ｼ・|
| Projects 譛蟆丞酔譛・| 笨・閾ｪ蜍募ｮ溯｡・| 笞・・繧ｹ繧ｭ繝・・・医お繝ｩ繝ｼ縺ｪ縺暦ｼ・|

譛ｪ險ｭ螳・PC 縺ｧ縺ｮ謇句虚繝輔か繝ｭ繝ｼ謇矩・ｼ亥ｿ・ｦ√↑蝣ｴ蜷医・縺ｿ・・

```powershell
# 1. de 縺檎函謌舌＠縺溘Ο繝ｼ繧ｫ繝ｫ JSON・域怙譁ｰ・峨ｒ螟画焚縺ｫ蜈･繧後ｋ
$json = (Get-ChildItem logs/runlog/runlog_*.json |
         Sort-Object LastWriteTime -Descending |
         Select-Object -First 1).FullName
# 萓・ logs\runlog\runlog_20260316_100652.json

# 2. Run_Log 繧ｷ繝ｼ繝医∈謇句虚霑ｽ險・
node scripts/append-runlog-to-sheet.mjs --json $json --write
# 竊・[OK] Appended Run_Log row to Run_Log!A25:J25

# 3. Projects 譛蟆丞酔譛滂ｼ域焔蜍包ｼ・
#    --project-id  : Projects 繧ｷ繝ｼ繝医↓逋ｻ骭ｲ貂医∩縺ｮ project_id・井ｾ・ JREC-01 / AIOS-06 / FREEE-02・・
#    --expected-commit : de 螳御ｺ・凾縺ｫ陦ｨ遉ｺ縺輔ｌ縺溘さ繝溘ャ繝医ワ繝・す繝･・井ｾ・ c7e48c2・・
node scripts/sync-project-from-runlog.mjs --json $json --project-id JREC-01 --expected-commit c7e48c2 --write
# 竊・[OK] Projects snapshot sync succeeded: Projects!A4:M4
```

隧ｳ邏ｰ: [ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md](./ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md)

## Step 10 — Google Drive export / upload のセットアップ

### 基本方針
- `workspace` は GitHub 正本の作業ディレクトリとして運用する
- `workspace-export` は Google Drive upload 用の安全な export として使う
- `de` 実行後に `workspace -> workspace-export` を更新し、その後 rclone で Google Drive へ upload する
- Google Drive for desktop の常駐同期は前提にしない
- Drive 側コピーや `workspace-export` 側では Git 作業をしない

### export の確認
```powershell
cd C:\hirayama-ai-workspace\workspace
.\scripts\sync-workspace-to-drive.ps1 -DryRun
.\scripts\sync-workspace-to-drive.ps1
```

既定の export 先:

```text
C:\hirayama-ai-workspace\workspace-export
```

### export 先を変更したい場合
```powershell
[Environment]::SetEnvironmentVariable('HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT', 'D:\shared\workspace-export', 'User')
```

### rclone の設定
```powershell
rclone config
rclone listremotes
[Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE', 'gdrive', 'User')
[Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE_PATH', 'hirayama-ai-workspace/workspace-export', 'User')
```

### 初回 upload の確認
初回は安全重視で `copy` を使います。

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy -DryRun
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy
```

### 通常運用
専用保存先だと確認できた後は `de` で通常運用します。`de` からの既定 upload は `sync` です。

```powershell
de -ProjectId AIOS-06 "chore: verify gdrive handoff"
```

### 一時的に回避したい場合
```powershell
de -ProjectId AIOS-06 -SkipDriveSync "docs: skip drive sync for this handoff"
de -ProjectId AIOS-06 -SkipGDriveUpload "docs: export only for this handoff"
```

### 確認ポイント
- `workspace-export\INDEX.md` が生成されているか
- `logs/drive-sync/drive-sync_*.log` と `drive-sync_*.json` が生成されているか
- `logs/gdrive-upload/gdrive-upload_*.json` が生成されているか
- `rclone listremotes` に指定 remote が見えるか

詳細: [docs/GOOGLE_DRIVE_SYNC.md](./docs/GOOGLE_DRIVE_SYNC.md)
