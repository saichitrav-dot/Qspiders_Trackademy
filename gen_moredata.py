import uuid, sys
sys.stdout.reconfigure(encoding="utf-8")
OUT = r"C:\Users\praks\Music\RecTrack-UX\RecTrack_moredata.sql"

def q(s): return "'" + str(s).replace("'", "''") + "'"

# subject spec: (main_subject, subject, target_completion, [ (chapter, [topics...]) ])
# each topic gets these sub-topics expanded with a couple of examples for volume
SUBJECTS = [
    ("Python Full stack", "Core Python", 0.55, [
        ("Python Basics", ["Variables", "Data Types", "Operators", "Strings", "Lists", "Dictionaries"]),
        ("Control Flow", ["If-Else", "For Loop", "While Loop", "Functions", "Lambda", "Comprehensions"]),
        ("OOP in Python", ["Classes", "Objects", "Inheritance", "Polymorphism", "Modules"]),
    ]),
    ("Test Automation", "Selenium WebDriver", 0.30, [
        ("Selenium Basics", ["Setup", "Locators", "XPath", "Waits", "Actions"]),
        ("Frameworks", ["TestNG", "Page Object Model", "Data Driven", "Reporting"]),
    ]),
    ("JAVA Full stack", "Spring Boot", 0.72, [
        ("Spring Core", ["Beans", "Dependency Injection", "Annotations", "Configuration"]),
        ("REST APIs", ["Controllers", "Services", "Repositories", "Exception Handling"]),
    ]),
    ("DevOps", "Docker & Kubernetes", 0.18, [
        ("Docker", ["Images", "Containers", "Volumes", "Networks", "Compose"]),
        ("Kubernetes", ["Pods", "Deployments", "Services", "Ingress"]),
    ]),
]

L = ["-- RecTrack extra data: more subjects + sub-topics (safe to re-run)", "begin;"]
main_rows, subj_rows, chap_rows, top_rows, st_rows, ci_rows = [], [], [], [], [], []
done_ids, partial_ids = [], []

for main, subject, target, chapters in SUBJECTS:
    main_rows.append((main,))
    sid = uuid.uuid4()
    subj_rows.append((sid, main, subject))
    # collect this subject's content_items to apply completion
    subj_items = []
    for ci_idx, (chap, topics) in enumerate(chapters):
        cid = uuid.uuid4(); chap_rows.append((cid, sid, chap, ci_idx + 1))
        for ti, topic in enumerate(topics):
            tid = uuid.uuid4(); top_rows.append((tid, cid, topic, ti + 1))
            # 3 sub-topics per topic for volume
            for k, suffix in enumerate(["introduction", "example", "exercise"]):
                stid = uuid.uuid4()
                st_rows.append((stid, tid, f"{topic} - {suffix}", k + 1))
                ciid = uuid.uuid4(); ci_rows.append((ciid, stid))
                subj_items.append(ciid)
    n = len(subj_items)
    n_done = int(round(target * n))
    n_part = min(int(round(0.15 * n)), n - n_done)
    done_ids += [str(x) for x in subj_items[:n_done]]
    partial_ids += [str(x) for x in subj_items[n_done:n_done + n_part]]

# inserts
L.append("insert into main_subject (id,name) values " +
         ",".join(f"({q(uuid.uuid4())},{q(m[0])})" for m in main_rows) + " on conflict (name) do nothing;")
L.append("insert into subject (id,main_subject_id,name,sequence) values " +
         ",".join(f"({q(sid)},(select id from main_subject where name={q(main)}),{q(name)},1)" for sid, main, name in subj_rows) +
         " on conflict (main_subject_id,name) do nothing;")
L.append("insert into chapter (id,subject_id,name,sequence) values " +
         ",".join(f"({q(cid)},{q(sid)},{q(nm)},{seq})" for cid, sid, nm, seq in chap_rows) + " on conflict (subject_id,name) do nothing;")
L.append("insert into topic (id,chapter_id,name,sequence) values " +
         ",".join(f"({q(tid)},{q(cid)},{q(nm)},{seq})" for tid, cid, nm, seq in top_rows) + " on conflict (chapter_id,name) do nothing;")
L.append("insert into subtopic (id,topic_id,name,sequence) values " +
         ",".join(f"({q(stid)},{q(tid)},{q(nm)},{seq})" for stid, tid, nm, seq in st_rows) + " on conflict (topic_id,name,sequence) do nothing;")
L.append("insert into content_item (id,subtopic_id) values " +
         ",".join(f"({q(ciid)},{q(stid)})" for ciid, stid in ci_rows) + " on conflict (subtopic_id) do nothing;")

# completion: fully-done items
if done_ids:
    L.append("update item_stage set status='Completed' where content_item_id in (" + ",".join(q(x) for x in done_ids) + ");")
# partial items: stages 1-3 done (current stage = Shooting)
if partial_ids:
    L.append("update item_stage ist set status=(case when s.sequence<=3 then 'Completed' else 'Not Started' end)::stage_status "
             "from stage s where ist.stage_id=s.id and ist.content_item_id in (" + ",".join(q(x) for x in partial_ids) + ");")

L.append("commit;")
L.append("select name, completion_pct, items from v_subject_completion order by completion_pct desc;")

open(OUT, "w", encoding="utf-8").write("\n".join(L))
print("WROTE", OUT)
print("new: subjects %d | sub-topics %d | content_items %d | done %d | partial %d"
      % (len(subj_rows), len(st_rows), len(ci_rows), len(done_ids), len(partial_ids)))
