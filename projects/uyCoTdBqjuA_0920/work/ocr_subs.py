import cv2, numpy as np, subprocess, json, sys
cap=cv2.VideoCapture('source/uyCoTdBqjuA_0920-1120.mp4'); fps=cap.get(5); n=int(cap.get(7))
def mask(fr):
    strip=fr[975:1055, 300:1620]
    hsv=cv2.cvtColor(strip,cv2.COLOR_BGR2HSV)
    return cv2.inRange(hsv,(22,150,200),(34,255,255))
events=[]; cur=None; cur_start=None; prev=None
for i in range(n):
    ok,fr=cap.read()
    if not ok: break
    if i%2: continue
    m=mask(fr); cnt=int((m>0).sum())
    if prev is not None:
        inter=np.logical_and(m>0,prev>0).sum(); uni=np.logical_or(m>0,prev>0).sum()
        iou=inter/uni if uni else 1
    else: iou=0
    changed = iou<0.6
    if changed:
        if cur is not None: events.append((cur_start,i/fps,cur))
        cur = m.copy() if cnt>250 else None; cur_start=i/fps
    prev=m
if cur is not None: events.append((cur_start,n/fps,cur))
out=[]
for k,(a,b,m) in enumerate(events):
    if b-a<0.15: continue
    img=cv2.copyMakeBorder(255-m,20,20,20,20,cv2.BORDER_CONSTANT,value=255)
    img=cv2.resize(img,None,fx=1.5,fy=1.5,interpolation=cv2.INTER_CUBIC)
    cv2.imwrite('/tmp/o.png',img)
    t=subprocess.run(['tesseract','/tmp/o.png','-','--psm','7','-l','eng'],capture_output=True,text=True).stdout.strip()
    out.append({'start':round(a,3),'end':round(b,3),'text':t}); print(f"{a:6.2f}-{b:6.2f} {t}")
json.dump(out,open('work/burned_subs.json','w'),ensure_ascii=False,indent=1)
