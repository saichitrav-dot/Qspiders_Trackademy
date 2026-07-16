import json, sys, urllib.request
gid = "52226e64dd95698aff45d12fafedd6ce"
token = sys.argv[1].strip()
html = open(r"C:\Users\praks\Music\RecTrack-UX\index.html", encoding="utf-8").read()
body = json.dumps({"files": {"index.html": {"content": html}}}).encode("utf-8")
req = urllib.request.Request(
    "https://api.github.com/gists/" + gid, data=body, method="PATCH",
    headers={"Authorization": "token " + token,
             "Accept": "application/vnd.github+json",
             "User-Agent": "rectrack-updater"})
with urllib.request.urlopen(req) as r:
    j = json.load(r)
    print("HTTP", r.status)
    print("v2 in gist:", "Content Production Pipeline" in j["files"]["index.html"]["content"])
    print("size:", j["files"]["index.html"]["size"], "bytes")
