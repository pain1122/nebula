#!/bin/sh
set -eu

# Definitions only: scanner has no app mount, storage credentials or patient paths.
# Always refresh before starting, even when the pinned image contains old databases.
sed '/^NotifyClamd /d' /etc/clamav/freshclam.conf > /tmp/freshclam-initial.conf
freshclam --foreground --stdout --config-file=/tmp/freshclam-initial.conf
freshclam --daemon --foreground --stdout --config-file=/etc/clamav/freshclam.conf &
updater_pid=$!
clamd --foreground --config-file=/etc/clamav/clamd.conf &
scanner_pid=$!
trap 'kill "$updater_pid" "$scanner_pid" 2>/dev/null || true; wait || true' EXIT
trap 'exit 0' TERM INT
while kill -0 "$updater_pid" 2>/dev/null && kill -0 "$scanner_pid" 2>/dev/null; do
    sleep 2
done
# A dead child must fail the container rather than leave a healthy-looking parent.
exit 1
