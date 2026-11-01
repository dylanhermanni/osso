#!/bin/sh
# BusyBox wget ignores no_proxy. Bypass proxy ONLY for the container's own loopback health endpoint.
# All non-loopback URLs retain the original proxy behavior.
for argument do
  case "$argument" in
    http://127.0.0.1:*|http://localhost:*) exec /usr/bin/wget -Y off "$@" ;;
  esac
done
exec /usr/bin/wget "$@"
