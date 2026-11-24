#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# kebena-coffee — privileged setup on srv1912542.hstgr.cloud
#
# Run once:   sudo bash /home/admin/apps/kebena-coffee-deploy/root-setup.sh
#
# It does four things, each idempotent and each skippable on a re-run:
#   1. MariaDB        — creates the `kebena_coffee` database + `kebena` user
#                       (the password is read from the app's .env; this file
#                       holds no secret) and imports kebena_coffee-dump.sql,
#                       a mariadb-dump of the laptop's database: schema, the
#                       drizzle migration log and the demo data together
#   2. systemd        — installs and starts kebena-coffee.service (runs as admin)
#   3. CyberPanel     — creates the child domain kebena.srv1912542.hstgr.cloud
#                       under srv1912542.hstgr.cloud and issues its Let's Encrypt
#                       certificate, the same way alpha. was made
#   4. OpenLiteSpeed  — turns that child domain's vhost into a reverse proxy to
#                       127.0.0.1:3100, and forces https
#
# Nothing outside those four areas is touched. Every file edited is backed up
# first and restored automatically if the site does not answer afterwards.
# Later schema changes go through `npm run db:migrate:remote` from the laptop.
# ---------------------------------------------------------------------------
set -euo pipefail

MASTER="srv1912542.hstgr.cloud"
DOMAIN="kebena.${MASTER}"
APP_DIR="/home/admin/apps/kebena-coffee"
DEPLOY_DIR="/home/admin/apps/kebena-coffee-deploy"
APP_USER="admin"
APP_PORT="3100"
SERVICE="kebena-coffee"
DB_NAME="kebena_coffee"
DB_USER="kebena"
LSWS="/usr/local/lsws"
VHCONF="${LSWS}/conf/vhosts/${DOMAIN}/vhost.conf"
CONF="${LSWS}/conf/httpd_config.conf"
TS="$(date +%Y%m%d-%H%M%S)"

[[ $EUID -eq 0 ]] || { echo "Run me with sudo."; exit 1; }
[[ -f "${APP_DIR}/.env" ]]           || { echo "!! ${APP_DIR}/.env is missing"; exit 1; }
[[ -f "${APP_DIR}/build/handler.js" ]] || { echo "!! ${APP_DIR}/build has not been shipped yet"; exit 1; }
[[ -f "${APP_DIR}/server.js" ]]      || { echo "!! ${APP_DIR}/server.js is missing"; exit 1; }

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

# The password lives in the app's .env only. Read it from there rather than
# keeping a second copy here.
DB_PASS="$(sed -n 's/^DATABASE_URL=//p' "${APP_DIR}/.env" | tr -d '"' | sed 's|.*mysql://[^:]*:||;s|@.*||')"
[[ -n "${DB_PASS}" ]] || { echo "!! could not read the database password from ${APP_DIR}/.env"; exit 1; }

# ---------------------------------------------------------------------------
step "1/4  MariaDB: database and user"
# ---------------------------------------------------------------------------
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
echo "    database + user ready"

DUMP="${DEPLOY_DIR}/kebena_coffee-dump.sql"
if mysql -N -B "${DB_NAME}" -e 'SHOW TABLES LIKE "__drizzle_migrations"' | grep -q .; then
  echo "    ${DB_NAME} already has tables — not importing the dump over them"
elif [[ -f "${DUMP}" ]]; then
  mysql "${DB_NAME}" < "${DUMP}"
  echo "    imported ${DUMP}: $(mysql -N -B -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema="'"${DB_NAME}"'"') tables, $(mysql -N -B "${DB_NAME}" -e 'SELECT COUNT(*) FROM user') users"
else
  echo "    !! ${DUMP} not found — the app will start against an empty database"
fi

# ---------------------------------------------------------------------------
step "2/4  systemd: ${SERVICE}.service"
# ---------------------------------------------------------------------------
NODE_BIN="$(sudo -u "${APP_USER}" bash -lc 'command -v node')"
echo "    node: ${NODE_BIN} ($(${NODE_BIN} -v))"
install -d -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}/files"

cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=${SERVICE} (SvelteKit / adapter-node)
After=network-online.target mariadb.service
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=${NODE_BIN} ${APP_DIR}/server.js
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE}

# Hardening — the app only needs to read its own directory and write uploads (FILES_DIR).
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=${APP_DIR}/files

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now "${SERVICE}.service"
systemctl restart "${SERVICE}.service"
sleep 4
if curl -sf --max-time 5 "http://127.0.0.1:${APP_PORT}/health" | grep -q '"status":"ok"'; then
  echo "    service active — /health answers on 127.0.0.1:${APP_PORT}"
else
  echo "    !! service is not healthy:"; journalctl -u "${SERVICE}" -n 30 --no-pager; exit 1
fi

# ---------------------------------------------------------------------------
step "3/4  CyberPanel: child domain ${DOMAIN} + Let's Encrypt"
# ---------------------------------------------------------------------------
if [[ -f "${VHCONF}" ]]; then
  echo "    ${DOMAIN} already exists — skipping createChild"
else
  # The child is owned by whoever owns the master site in CyberPanel.
  OWNER="$(cyberpanel listWebsitesJson 2>/dev/null | python3 -c '
import sys, json, re
raw = sys.stdin.read()
try:
    sites = json.loads(raw)
    if isinstance(sites, str): sites = json.loads(sites)
except Exception:
    sites = []
for s in sites if isinstance(sites, list) else []:
    if s.get("domain") == "'"${MASTER}"'":
        print(s.get("admin") or "admin"); break
else:
    m = re.search(r"\"domain\":\s*\"'"${MASTER}"'\".*?\"admin\":\s*\"([^\"]+)\"", raw, re.S)
    print(m.group(1) if m else "admin")
')"
  echo "    owner of ${MASTER} in CyberPanel: ${OWNER}"
  cyberpanel createChild --masterDomain "${MASTER}" --childDomain "${DOMAIN}" --owner "${OWNER}" --php 8.3
  [[ -f "${VHCONF}" ]] || { echo "    !! createChild did not produce ${VHCONF}"; exit 1; }
  echo "    child domain created"
fi

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "    certificate already present"
else
  cyberpanel issueSSL --domainName "${DOMAIN}"
  [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]] \
    && echo "    certificate issued" \
    || echo "    !! no certificate at /etc/letsencrypt/live/${DOMAIN} — continuing; https will use the server default until it is issued"
fi

# ---------------------------------------------------------------------------
step "4/4  OpenLiteSpeed: proxy ${DOMAIN} → 127.0.0.1:${APP_PORT}"
# ---------------------------------------------------------------------------
cp -a "${VHCONF}" "${VHCONF}.bak.${SERVICE}.${TS}"
cp -a "${CONF}"   "${CONF}.bak.${SERVICE}.${TS}"
echo "    backed up ${VHCONF} and ${CONF} (.bak.${SERVICE}.${TS})"

python3 - "${VHCONF}" "${DOMAIN}" "${APP_PORT}" <<'PY'
import re, sys
path, domain, port = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path).read()
added = []

# Renewals: acme.sh writes the http-01 token under Example/html, and this
# context has to win over the proxy below or every renewal fails.
if "/.well-known/acme-challenge" not in src:
    src = src.rstrip() + """

context /.well-known/acme-challenge {
  location                /usr/local/lsws/Example/html/.well-known/acme-challenge
  allowBrowse             1

  rewrite  {
     enable                  0
  }
  addDefaultCharset       off
}
"""
    added.append("acme context")

if f"extprocessor kebenaapp" not in src:
    src = src.rstrip() + f"""

extprocessor kebenaapp {{
  type                    proxy
  address                 127.0.0.1:{port}
  maxConns                100
  pcKeepAliveTimeout      60
  initTimeout             60
  retryTimeout            0
  respBuffer              0
}}
"""
    added.append("extprocessor")

if re.search(r"^context\s+/\s*\{", src, re.M) is None:
    src = src.rstrip() + """

context / {
  type                    proxy
  handler                 kebenaapp
  addDefaultCharset       off
}
"""
    added.append("context /")

# Force https: the session cookie is Secure, so plain http can never sign in.
rule = (f"  rules                   <<<END_rules\n"
        f"RewriteCond %{{HTTPS}} !on\n"
        f"RewriteRule ^(.*)$ https://{domain}%{{REQUEST_URI}} [R=301,L]\n"
        f"  END_rules\n")
if "RewriteCond %{HTTPS}" not in src:
    m = re.search(r"^rewrite\s*\{[^}]*?(?=^\})", src, re.M | re.S)
    if m and "rules" not in m.group(0):
        block = m.group(0)
        if "enable" in block:
            block = re.sub(r"^(\s*enable\s+)\S+", r"\g<1>1", block, count=1, flags=re.M)
        else:
            block = block.rstrip("\n") + "\n  enable                  1\n"
        src = src[:m.start()] + block.rstrip("\n") + "\n" + rule + src[m.end():]
    else:
        src = src.rstrip() + "\n\nrewrite  {\n  enable                  1\n" + rule + "}\n"
    added.append("https redirect")

open(path, "w").write(src)
print("    vhost changes:", ", ".join(added) if added else "none (already configured)")
PY

echo "    restarting OpenLiteSpeed..."
"${LSWS}/bin/lswsctrl" restart >/dev/null 2>&1 || true
sleep 5

ok=1
read -r code body < <(curl -sk --max-time 20 --resolve "${DOMAIN}:443:127.0.0.1" \
      -w '\n%{http_code}' "https://${DOMAIN}/health" | tac | tr '\n' ' ' || echo "000 -")
printf '    https://%s/health  %s  %s\n' "${DOMAIN}" "${code}" "${body}"
[[ "${code}" == "200" && "${body}" == *'"status":"ok"'* ]] || ok=0
redir="$(curl -s --max-time 20 --resolve "${DOMAIN}:80:127.0.0.1" -o /dev/null -w '%{http_code} %{redirect_url}' "http://${DOMAIN}/kc-login" || echo "000 -")"
printf '    http://%s/kc-login    %s\n' "${DOMAIN}" "${redir}"
[[ "${redir}" == 301\ https://${DOMAIN}/kc-login* ]] || ok=0

if [[ ${ok} -ne 1 ]]; then
  echo
  echo "    !! verification failed — restoring the previous OpenLiteSpeed config"
  cp -a "${VHCONF}.bak.${SERVICE}.${TS}" "${VHCONF}"
  cp -a "${CONF}.bak.${SERVICE}.${TS}"   "${CONF}"
  "${LSWS}/bin/lswsctrl" restart >/dev/null 2>&1 || true
  echo "    rolled back. The app itself is still running on 127.0.0.1:${APP_PORT}:"
  curl -s -o /dev/null -w "      direct app check: %{http_code}\n" "http://127.0.0.1:${APP_PORT}/health"
  echo "      OpenLiteSpeed error log: tail -50 ${LSWS}/logs/error.log"
  exit 1
fi

printf '\n\033[1;32mDone.\033[0m  https://%s/\n\n' "${DOMAIN}"
echo "Sign in at https://${DOMAIN}/kc-login with a seeded staff login (owner@kebena.coffee, see scripts/seed/base.ts)."
echo "Useful:"
echo "  systemctl status ${SERVICE}      # app status"
echo "  journalctl -u ${SERVICE} -f      # app logs"
echo "  As admin, a graceful restart is: kill -TERM \$(pgrep -u admin -f '${APP_DIR}/[s]erver\\.js')"
