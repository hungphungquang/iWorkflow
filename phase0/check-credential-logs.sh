#!/bin/bash
# Read-only: count (never print) log lines that may contain credentials.
PAT='password=|passwd|j_password|credentials|pwd='
echo "=== journald iw_prod / iw_dev (all retained logs)"
for u in iw_prod iw_dev; do
  total=$(journalctl -u "$u" --no-pager -q 2>/dev/null | wc -l)
  hits=$(journalctl -u "$u" --no-pager -q 2>/dev/null | grep -Eic "$PAT")
  echo "$u: lines=$total matches=$hits"
done
echo "=== retention of journald"
journalctl --disk-usage 2>/dev/null
journalctl -u iw_prod --no-pager -q -o short-iso 2>/dev/null | head -1 | cut -c1-25
echo "=== nginx logs: requests carrying password in URL"
for f in /var/log/nginx/access.log*; do
  [ -f "$f" ] || continue
  hits=$(zgrep -Eic "$PAT" "$f" 2>/dev/null)
  echo "$f: matches=$hits"
done
echo "=== app log files written by the jar (if any)"
find /home/iworkflow /var/log -maxdepth 3 -type f \( -name '*.log' -o -name 'spring*.log' \) -newermt '2024-01-01' 2>/dev/null | grep -v nginx | head -20
echo "=== LDAPS truststore path hard-coded in code"
ls -l /usr/lib/jvm/java-1.8.0-openjdk-1.8.0.191.b12-1.el7_6.x86_64/jre/lib/security/cacerts1.jsk 2>&1 | cut -c1-120
