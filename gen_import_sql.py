import sys, uuid, pandas as pd
sys.stdout.reconfigure(encoding="utf-8")
SRC=r"C:\Users\praks\OneDrive\Desktop\Rec app.xlsx"
OUT=r"C:\Users\praks\Music\RecTrack-UX\RecTrack_import.sql"

def q(s): return "'" + str(s).replace("'","''") + "'"

df=pd.read_excel(SRC,sheet_name="Subjects and Status")
df.columns=[str(c).strip() for c in df.columns]
for c in ["Main Subject","Subject","ChapterName","TopicName"]: df[c]=df[c].ffill()
df["TopicName"]=df["TopicName"].fillna("General")
df=df[df["Sub-topics"].notna()].copy().reset_index(drop=True)

main={}; subj={}; chap={}; top={}; subs=[]; items=[]
for _,r in df.iterrows():
    ms,su,ch,tp,sb=r["Main Subject"],r["Subject"],r["ChapterName"],r["TopicName"],str(r["Sub-topics"]).strip()
    if ms not in main: main[ms]=uuid.uuid4()
    k=(main[ms],su)
    if k not in subj: subj[k]=(uuid.uuid4(),len(subj)+1)
    sid=subj[k][0]
    k=(sid,ch)
    if k not in chap: chap[k]=(uuid.uuid4(),len(chap)+1)
    cid=chap[k][0]
    k=(cid,tp)
    if k not in top: top[k]=(uuid.uuid4(),len(top)+1)
    tid=top[k][0]
    seq=sum(1 for x in subs if x[1]==tid)+1
    stid=uuid.uuid4(); subs.append((stid,tid,sb,seq)); items.append((uuid.uuid4(),stid))

L=["-- RecTrack import: people + Core Java curriculum","-- Run in Supabase SQL Editor (safe to re-run).","begin;"]

people=[("Madhu","madhu@example.com","trainer","Internal"),
        ("Akash","akash@example.com","trainer","Internal"),
        ("Leo","leo@example.com","trainer","Internal"),
        ("Amy","amy@example.com","trainer","Internal"),
        ("Pamy","pamy@example.com","trainer","External"),
        ("Priya","priya@example.com","admin",None)]
pv=",".join(f"({q(uuid.uuid4())},{q(n)},{q(e)},{q(role)},{'NULL' if tt is None else q(tt)},1)" for n,e,role,tt in people)
L.append(f"insert into person (id,full_name,email,role,trainer_type,launch_phase) values {pv} on conflict (email) do nothing;")

mv=",".join(f"({q(u)},{q(name)},{i+1})" for i,(name,u) in enumerate(main.items()))
L.append(f"insert into main_subject (id,name,sort) values {mv} on conflict (name) do nothing;")

sv=",".join(f"({q(sid)},{q(mu)},{q(sname)},{seq})" for (mu,sname),(sid,seq) in subj.items())
L.append(f"insert into subject (id,main_subject_id,name,sequence) values {sv} on conflict (main_subject_id,name) do nothing;")

cv=",".join(f"({q(cid)},{q(su)},{q(cname)},{seq})" for (su,cname),(cid,seq) in chap.items())
L.append(f"insert into chapter (id,subject_id,name,sequence) values {cv} on conflict (subject_id,name) do nothing;")

tv=",".join(f"({q(tid)},{q(cu)},{q(tname)},{seq})" for (cu,tname),(tid,seq) in top.items())
L.append(f"insert into topic (id,chapter_id,name,sequence) values {tv} on conflict (chapter_id,name) do nothing;")

stv=",".join(f"({q(stid)},{q(tid)},{q(name)},{seq})" for (stid,tid,name,seq) in subs)
L.append(f"insert into subtopic (id,topic_id,name,sequence) values {stv} on conflict (topic_id,name,sequence) do nothing;")

civ=",".join(f"({q(ciid)},{q(stid)})" for (ciid,stid) in items)
L.append(f"insert into content_item (id,subtopic_id) values {civ} on conflict (subtopic_id) do nothing;")

L.append("commit;")
L.append("-- counts:")
L.append("select 'people' as item, count(*) from person "
         "union all select 'subjects', count(*) from subject "
         "union all select 'chapters', count(*) from chapter "
         "union all select 'topics', count(*) from topic "
         "union all select 'sub-topics', count(*) from subtopic "
         "union all select 'content_items', count(*) from content_item "
         "union all select 'item_stages (auto)', count(*) from item_stage;")

open(OUT,"w",encoding="utf-8").write("\n".join(L))
print("WROTE",OUT)
print("people %d | subjects %d | chapters %d | topics %d | subtopics %d | content_items %d"
      %(len(people),len(subj),len(chap),len(top),len(subs),len(items)))
print("expected item_stages after import:",len(items)*7)
