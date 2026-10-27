#!/usr/bin/env python3
"""Create standalone NARAE OFFICE from official IeumOffice v0.12.4 sources.
Keep original document and AI code; change visual shell and installation identity.
"""
from pathlib import Path
import json,sys

ROOT=Path(sys.argv[1]).resolve()
assert (ROOT/"apps/shell/package.json").exists()
assert json.loads((ROOT/"apps/shell/package.json").read_text())["version"]=="0.12.4"

def change(path,old,new,one=True):
    p=ROOT/path
    s=p.read_text(encoding="utf-8")
    n=s.count(old)
    if not n or (one and n!=1):
        raise RuntimeError(f"{path}: expected {1 if one else 'some'} occurrences of {old[:70]}, got {n}")
    p.write_text(s.replace(old,new,1) if one else s.replace(old,new),encoding="utf-8")
    print("PATCH",path)
def full(path,transform):
    p=ROOT/path;s=p.read_text(encoding="utf-8");p.write_text(transform(s),encoding="utf-8")
D=chr(36); BT=chr(96)
change("packages/i18n/src/product.ts","export const PRODUCT_NAME = 'IeumOffice'","export const PRODUCT_NAME = 'NARAE OFFICE'")
change("packages/i18n/src/product.ts","ko: '이음오피스'","ko: 'NARAE OFFICE'")
change("packages/i18n/src/product.ts","export const PRODUCT_REPO_OWNER = 'pblsketch'","export const PRODUCT_REPO_OWNER = 'kangseungjae1489'")
change("packages/i18n/src/product.ts","export const PRODUCT_REPO_NAME = 'openoffice'","export const PRODUCT_REPO_NAME = 'narae-office'")
change("packages/i18n/src/product.ts","export const PRODUCT_WEBSITE = 'https://ieumoffice.com'","export const PRODUCT_WEBSITE = 'https://github.com/kangseungjae1489/narae-office'")
change("apps/shell/package.json",'"productName": "IeumOffice"','"productName": "NARAE OFFICE"')
change("apps/shell/package.json",'"homepage": "https://github.com/pblsketch/openoffice"','"homepage": "https://github.com/kangseungjae1489/narae-office"')
pb="apps/shell/electron-builder.cjs"
for a,b in [
("const APP_ID = 'io.github.pblsketch.ieumoffice'","const APP_ID = 'io.github.kangseungjae1489.naraeoffice'"),
("const PRODUCT_NAME = 'IeumOffice'","const PRODUCT_NAME = 'NARAE OFFICE'"),
("const PACKAGED_APP_NAME = 'ieumoffice'","const PACKAGED_APP_NAME = 'narae-office'"),
("const REPO_OWNER = 'pblsketch'","const REPO_OWNER = 'kangseungjae1489'"),
("const REPO_NAME = 'openoffice'","const REPO_NAME = 'narae-office'"),
("from: '../../packages/cli/bin/ieumoffice',","from: '../../packages/cli/bin/narae-office',"),
("to: 'cli/ieumoffice',","to: 'cli/narae-office',"),
("from: '../../packages/cli/bin/ieumoffice.cmd',","from: '../../packages/cli/bin/narae-office.cmd',"),
("to: 'cli/ieumoffice.cmd',","to: 'cli/narae-office.cmd',"),
("'" + D+"{productName}-Setup-"+D+"{version}-arm64."+D+"{ext}'", "'NARAE_OFFICE_Setup-"+D+"{version}-arm64."+D+"{ext}'"),
("'" + D+"{productName}-Setup-"+D+"{version}."+D+"{ext}'", "'NARAE_OFFICE_Setup-"+D+"{version}."+D+"{ext}'"),
]:
    change(pb,a,b)
change(pb,"const winProgId = (name) => "+BT+D+"{PRODUCT_NAME}.","const winProgId = (name) => "+BT+"NARAEOffice.")
def fix_nsis(s):
    assert s.count("IeumOffice")>=15
    return s.replace("IeumOffice.","NARAEOffice.").replace("Software\\IeumOffice","Software\\NARAEOffice").replace("IeumOffice","NARAE OFFICE")
full("apps/shell/build/installer.nsh",fix_nsis)
change("apps/shell/src/main/default-app.ts","IeumOffice.","NARAEOffice.",one=False)
change("packages/cli/src/names.ts","export const CLI_COMMAND = 'ieumoffice'","export const CLI_COMMAND = 'narae-office'")
change("packages/cli/package.json",'"ieumoffice": "./bin/ieumoffice"','"narae-office": "./bin/narae-office"')
for orig,new in [("ieumoffice.cmd","narae-office.cmd"),("ieumoffice","narae-office")]:
    p=ROOT/"packages/cli/bin"/orig
    text=p.read_text(encoding="utf-8").replace("IeumOffice.exe","NARAE OFFICE.exe")
    text=text.replace("/IeumOffice"+'"',"/NARAE OFFICE"+'"')
    (p.parent/new).write_text(text,encoding="utf-8")
change("apps/shell/src/main/index.ts","join(process.env.LOCALAPPDATA ?? tmpdir(), 'IeumOffice', 'agent-skills')","join(process.env.LOCALAPPDATA ?? tmpdir(), 'NARAE OFFICE', 'agent-skills')")
change("apps/shell/src/main/index.ts","join(tmpdir(), 'ieumoffice-skills')","join(tmpdir(), 'narae-office-skills')")
change("apps/shell/src/main/index.ts","'ieumoffice-template-copies'","'narae-office-template-copies'")
# Branding visuals for home and AI chat. Native editors stay on upstream engines.
assets=ROOT/"apps/shell/src/renderer/src/assets"
logo='<svg xmlns="http://www.w3.org/2000/svg" width="390" height="66" viewBox="0 0 390 66"><defs><linearGradient id="g"><stop stop-color="#ad654d"/><stop offset=".5" stop-color="#f9dca7"/><stop offset="1" stop-color="#ad654d"/></linearGradient></defs><g fill="none" stroke="url(#g)" stroke-width="3"><path d="M29 52C7 33 12 23 24 24C21 13 27 6 33 2C43 8 46 13 42 24C56 23 60 36 37 52L33 56Z"/><path d="M33 12V53M17 31L33 53L49 31"/></g><text x="76" y="45" fill="#754752" font-size="35" font-family="Georgia,serif" font-weight="bold">NARAE</text><text x="231" y="45" fill="#aa7760" font-size="27" font-family="Georgia,serif">OFFICE</text></svg>'
mascot='<svg xmlns="http://www.w3.org/2000/svg" width="150" height="160" viewBox="0 0 150 160"><defs><linearGradient id="p"><stop stop-color="#fff1f3"/><stop offset=".5" stop-color="#f8b5cb"/><stop offset="1" stop-color="#bf7791"/></linearGradient><linearGradient id="g"><stop stop-color="#ac6a43"/><stop offset=".5" stop-color="#f8e1a4"/><stop offset="1" stop-color="#bb814c"/></linearGradient></defs><path d="M67 24L56 6Q71 3 75 17Q83 3 97 6L83 24" fill="url(#p)" stroke="#bb814c" stroke-width="3"/><rect x="20" y="25" width="110" height="83" rx="30" fill="url(#p)" stroke="url(#g)" stroke-width="5"/><rect x="32" y="37" width="86" height="60" rx="23" fill="#17161d" stroke="#d69b66" stroke-width="4"/><path d="M45 70Q58 52 69 70M81 70Q93 52 106 70" fill="none" stroke="#ffc77b" stroke-width="5" stroke-linecap="round"/><path d="M70 79Q75 86 80 79" fill="none" stroke="#ffc77b" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="70" r="14" fill="url(#g)"/><circle cx="130" cy="70" r="14" fill="url(#g)"/><rect x="51" y="111" width="49" height="32" rx="12" fill="url(#p)" stroke="#c38d61" stroke-width="4"/><text x="75" y="131" font-size="9" font-family="Arial" text-anchor="middle" fill="#955f52">NARAE</text><path d="M41 120L31 133M109 120L119 133M63 144L59 154M88 144L91 154" stroke="url(#g)" stroke-width="9" stroke-linecap="round"/></svg>'
(assets/"narae-logo.svg").write_text(logo,encoding="utf-8")
(assets/"narae-mascot.svg").write_text(mascot,encoding="utf-8")
change("apps/shell/src/renderer/src/main.tsx","import './tabbar.css'\n","import './tabbar.css'\nimport './narae-theme.css'\n")
home="apps/shell/src/renderer/src/Home.tsx"
change(home,"import logoLockup from './assets/genoffice-logo.svg'","import logoLockup from './assets/narae-logo.svg'")
change(home,"import logoLockup from './assets/narae-logo.svg'\n","import logoLockup from './assets/narae-logo.svg'\nimport naraeMascot from './assets/narae-mascot.svg'\n")
change(home,'        <nav className="sidebar-nav">','        <div className="narae-sidebar-tag">ROSE GOLD EDITION</div>\n        <nav className="sidebar-nav">')
change(home,"        {renderFolderPanel()}\n        <AccountEntry","        {renderFolderPanel()}\n        <div className=\"narae-maker\"><img src={naraeMascot} alt=\"\" /><div><b>루미나래 · 제작자</b><small>인천직업전문학교 미용 주임교사<br/>AI 피부 분석 앱 개발 중</small></div></div>\n        <AccountEntry")
ai="apps/shell/src/renderer/src/KbAskPanel.tsx"
change(ai,"import { useCallback, useEffect, useRef, useState } from 'react'","import naraeMascot from './assets/narae-mascot.svg'\nimport { useCallback, useEffect, useRef, useState } from 'react'")
change(ai,'    <div className="kb-ask">','    <div className="kb-ask"><div className="narae-ai-head"><img src={naraeMascot} alt=\"\"/><b>AI 루미나래</b></div>')
theme="""/* NARAE OFFICE rose-gold branding; no editor/AI logic changes */
:root{--accent:#b85c78;--accent-hover:#a54867;--accent-soft:#fae5ed;--color-brand-secondary:#b85c78;--color-border-brand:#b85c78;--bg-content:#fffafa;--surface-subtle:#fff5f4;--border:#ead7d6;--bg-hover:#fcebee;}
[data-theme='dark']{--accent:#f0a0ba;--accent-hover:#f6b5cb;--accent-soft:#4f3542}
.tab-bar{--tabstrip-bg:#f4e8e8;--tabstrip-text:#734750;--tabstrip-text-active:#4d3035}
.sidebar{background:linear-gradient(155deg,#fffaf7,#faeced 75%,#f1d9da)}
.content{background:linear-gradient(145deg,#fffaf9,#fff4f4)}
.logo-lockup{filter:none;height:25px}
.narae-sidebar-tag{margin:-11px 8px 13px;color:#ad7884;letter-spacing:.16em;font-size:9px;font-weight:700}
.narae-maker{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.7);border:1px solid #ead1cd;border-radius:12px;margin:13px 3px;padding:9px 6px;color:#6f4552}
.narae-maker img{width:40px;height:45px;animation:narae-float 3.5s ease-in-out infinite}
.narae-maker b{font-size:11px;display:block}
.narae-maker small{font-size:9px;line-height:1.45;display:block}
.narae-ai-head{display:flex;align-items:center;gap:8px;padding:5px 14px;background:#fff5f6;color:#854452;border-bottom:1px solid #eed5d6}
.narae-ai-head img{width:31px;height:36px;animation:narae-float 3.5s ease-in-out infinite}
@keyframes narae-float{50%{transform:translateY(-4px)}}
@media(prefers-reduced-motion:reduce){.narae-maker img,.narae-ai-head img{animation:none}}
"""
(ROOT/"apps/shell/src/renderer/src/narae-theme.css").write_text(theme,encoding="utf-8")
p=ROOT/"NOTICE"
p.write_text(p.read_text(encoding="utf-8")+"""
NARAE OFFICE downstream modification notice (2026-10-27).
Based on IeumOffice v0.12.4, https://github.com/pblsketch/openoffice (Apache-2.0).
Independent downstream changes: visual identity, local storage and installer IDs,
Windows file associations, CLI command, and GitHub release feed.
Original copyright and all third-party notices are retained.
""",encoding="utf-8")
assert "IeumOffice" not in (ROOT/"apps/shell/build/installer.nsh").read_text()
assert "NARAE OFFICE" in (ROOT/"apps/shell/package.json").read_text()
print("Independent NARAE branding complete. Original editor and AI providers untouched.")
