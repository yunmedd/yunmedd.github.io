#!/usr/bin/env python3
"""Cache public posts from Naver RSS to assets/blog-feed.json (+ thumbnails).
The public website only reads local files, avoiding client-side CORS and
Naver's hotlink protection (pstatic.net returns 403 to foreign Referers).
Run by GitHub Action or a scheduled task. On failure leaves last good file unchanged.
"""
import hashlib
import io
import json
import re
import email.utils
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path

BLOG='yunmedd'
FEED=f'https://rss.blog.naver.com/{BLOG}.xml'
ASSETS=Path(__file__).resolve().parents[1]/'assets'
OUT=ASSETS/'blog-feed.json'
THUMBS=ASSETS/'blog-thumbs'
THUMB_PX=480
UA='YunClinicFeed/1.1 (+https://blog.naver.com/yunmedd)'
IMG_HOSTS=('blogthumb.pstatic.net','postfiles.pstatic.net','blogfiles.pstatic.net','mblogthumb-phinf.pstatic.net')
# 진료 공지로 인식할 블로그 카테고리 이름과 제목 머리말
NOTICE_CATEGORIES={'진료안내','진료 안내','공지사항','공지','휴진안내','휴진 안내'}
NOTICE_TITLE=re.compile(r'^\s*[\[【(〔]\s*(진료\s*안내|휴진|공지|진료\s*변경|진료\s*시간)')

def text(node,key):
    item=node.find(key)
    return ''.join(item.itertext()).strip() if item is not None else ''

def get(url,limit=6_000_000,timeout=18):
    req=urllib.request.Request(url,headers={'User-Agent':UA})  # Referer 없이 요청해야 403이 나지 않음
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read(limit)

def safe_img(src):
    src=(src or '').replace('&amp;','&').strip()
    p=urllib.parse.urlsplit(src)
    return src if p.scheme=='https' and p.hostname in IMG_HOSTS else ''

def find_image(item,log_no):
    m=re.search(r'<img[^>]+src="([^"]+)"',text(item,'description'))
    src=safe_img(m.group(1)) if m else ''
    if not src:  # 대표 이미지가 RSS에 없으면 글의 og:image 사용
        try:
            html=get(f'https://m.blog.naver.com/{BLOG}/{log_no}',limit=800_000).decode('utf-8','ignore')
            m=re.search(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"',html)
            src=safe_img(m.group(1)) if m else ''
        except Exception:
            src=''
    return src

def make_thumb(src,log_no):
    """Download once per (post, image) pair → assets/blog-thumbs/{logNo}-{hash}.webp"""
    from PIL import Image
    base=src.split('?')[0]
    name=f'{log_no}-{hashlib.sha1(base.encode()).hexdigest()[:8]}.webp'
    dest=THUMBS/name
    if dest.exists():return name
    raw=None
    for variant in (base+'?type=w2',src):  # w2 ≈ 740px, 원본 RSS 썸네일(s3)은 365px
        try:
            raw=get(variant);break
        except Exception:
            continue
    if not raw:return ''
    im=Image.open(io.BytesIO(raw));im.load()
    im=im.convert('RGB')
    w,h=im.size
    if w>THUMB_PX:
        im=im.resize((THUMB_PX,round(h*THUMB_PX/w)),Image.LANCZOS)
    THUMBS.mkdir(parents=True,exist_ok=True)
    im.save(dest,'WEBP',quality=80,method=6)
    return name

def main():
    request=urllib.request.Request(FEED,headers={'User-Agent':UA,'Accept':'application/rss+xml, application/xml, text/xml'})
    with urllib.request.urlopen(request,timeout=18) as response:
        xml=response.read(4_000_000)
    root=ET.fromstring(xml)
    posts=[];notices=[];seen=set()
    for item in root.findall('.//channel/item'):
        url=text(item,'link').strip()
        parsed=urllib.parse.urlsplit(url)
        if parsed.scheme not in ('http', 'https') or parsed.hostname not in ('blog.naver.com','m.blog.naver.com'):
            continue
        query=urllib.parse.parse_qs(parsed.query)
        direct_path=parsed.path.startswith(f'/{BLOG}/') and parsed.path.rstrip('/').split('/')[-1].isdigit()
        postview=(parsed.path.endswith('/PostView.naver') or parsed.path.endswith('/PostView.naver?')) and query.get('blogId',[''])[0]==BLOG and query.get('logNo',[''])[0].isdigit()
        if not (direct_path or postview):
            continue
        log_no=query['logNo'][0] if postview else parsed.path.rstrip('/').split('/')[-1]
        url=f'https://blog.naver.com/{BLOG}/{log_no}'
        title=' '.join(text(item,'title').split())
        if not title or url in seen:continue
        seen.add(url)
        rawdate=text(item,'pubDate')
        try:
            dt=email.utils.parsedate_to_datetime(rawdate)
            short=dt.astimezone(timezone(timedelta(hours=9))).date().isoformat()
        except (TypeError,ValueError,OverflowError,AttributeError):short=''
        cats=[' '.join(c.itertext()).strip() for c in item.findall('category')]
        entry={'title':title[:160],'url':url,'date':short}
        if (set(cats) & NOTICE_CATEGORIES) or NOTICE_TITLE.search(title):
            if len(notices)<5: notices.append(entry)
        elif len(posts)<12:
            entry['cat']=(cats[0].split('-')[0].strip() if cats else '')[:20]
            try:
                src=find_image(item,log_no)
                name=make_thumb(src,log_no) if src else ''
            except Exception as e:  # 썸네일 실패는 글 목록 갱신을 막지 않음
                print(f'thumb skipped {log_no}: {e}');name=''
            if name:entry['thumb']=f'assets/blog-thumbs/{name}'
            posts.append(entry)
    if not posts:raise RuntimeError('RSS returned no valid posts, keeping last good cache')
    keep={Path(p['thumb']).name for p in posts if p.get('thumb')}
    try:  # index.html에 정적으로 박힌 썸네일은 다음 빌드 전까지 유지
        keep|=set(re.findall(r'assets/blog-thumbs/([\w-]+\.webp)',(ASSETS.parent/'index.html').read_text(encoding='utf-8')))
    except OSError:pass
    if THUMBS.exists():
        for f in THUMBS.glob('*.webp'):
            if f.name not in keep:f.unlink()  # 목록에서 빠진 글의 썸네일 정리
    payload={'source':'rss.blog.naver.com/yunmedd.xml','updatedAt':datetime.now(timezone.utc).isoformat(timespec='seconds'),'notices':notices,'posts':posts}
    tmp=OUT.with_suffix('.tmp');tmp.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8');tmp.replace(OUT)
    print(f'updated {len(posts)} posts, {len(notices)} notices, {len(keep)} thumbs kept')

if __name__=='__main__':main()
