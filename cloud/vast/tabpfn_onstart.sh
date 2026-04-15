#!/usr/bin/env bash
set -euxo pipefail

REPO_URL="${REPO_URL:-https://github.com/AbdullahMadoun/OSProject.git}"
REPO_DIR="${REPO_DIR:-/workspace/OSProject}"
PORT="${PORT:-8000}"
TABPFN_BACKEND="${TABPFN_BACKEND:-tabpfn-local}"

export DEBIAN_FRONTEND=noninteractive

if ! command -v git >/dev/null 2>&1; then
  apt-get update
  apt-get install -y git
fi

if [ ! -d "${REPO_DIR}/.git" ]; then
  git clone "${REPO_URL}" "${REPO_DIR}"
else
  git -C "${REPO_DIR}" fetch --depth 1 origin main
  git -C "${REPO_DIR}" reset --hard origin/main
fi

cd "${REPO_DIR}"
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

mkdir -p /var/log/tabpfn
nohup python3 ml/predict_http_server.py \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --model ml/tabpfn_models.pkl \
  --data ml/runs.csv \
  --backend "${TABPFN_BACKEND}" \
  --shutdown-after-predict \
  > /var/log/tabpfn/server.log 2>&1 &

echo $! > /var/log/tabpfn/server.pid
