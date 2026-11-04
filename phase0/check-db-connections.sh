#!/bin/bash
# Read-only check: which DB does each eform instance use? Never prints passwords.
cd /home/iworkflow/iworkflow || exit 1

echo "=== start.sh (dev / prod)"
cat dev/start.sh; echo; cat prod/start.sh; echo

echo "=== jar sha256"
sha256sum dev/eform.jar prod/eform.jar

echo "=== EformApplication.class: sha256 + JDBC URL + user (password hidden)"
for e in dev prod; do
python3 - "$e" <<'PY'
import hashlib, re, sys, zipfile
env = sys.argv[1]
d = zipfile.ZipFile(f"{env}/eform.jar").read("com/eform/EformApplication.class")
urls = sorted({m.decode() for m in re.findall(rb"jdbc:[\x20-\x7e]+", d)})
print(env, hashlib.sha256(d).hexdigest()[:16], urls, "user iworkflow present:", b"iworkflow" in d)
PY
done

echo "=== application.properties inside each jar (datasource lines, password hidden)"
for e in dev prod; do
python3 - "$e" <<'PY'
import sys, zipfile
env = sys.argv[1]
for line in zipfile.ZipFile(f"{env}/eform.jar").read("application.properties").decode("utf-8", "replace").splitlines():
    if line.startswith("spring.datasource") and "password" not in line:
        print(env, line)
PY
done

echo "=== resolve database.iworkflow"
getent hosts database.iworkflow
grep -n "iworkflow" /etc/hosts

echo "=== live PostgreSQL connections per eform process"
for p in $(pgrep -f eform.jar); do
  echo "PID $p: $(tr '\0' ' ' < /proc/$p/cmdline)"
  ss -tnp | grep "pid=$p," | grep ":5432" | awk '{print "    " $4 " -> " $5}' | sort | uniq -c
done
