# Vast On-Demand TabPFN

This directory prepares a standard Docker-based Vast.ai instance for
on-demand local `tabpfn` inference.

## Why Docker Instance, Not VM

This workload is a single Python service and does not need nested Docker,
`systemd`, or full host semantics. A standard Vast Docker-based instance is
the correct cheaper and faster path.

## Remote Service

The instance startup script is [tabpfn_onstart.sh](./tabpfn_onstart.sh). It:

1. clones this repository
2. installs Python dependencies
3. starts `ml/predict_http_server.py`

The server exposes:

- `GET /health`
- `POST /predict`

The default startup behavior is one-shot:

- it serves exactly one `/predict`
- the Python service exits immediately after that request
- the local controller should then destroy the Vast instance

## Required Environment

- `VAST_API_KEY`
- `TABPFN_TOKEN`
  Required for headless local `tabpfn` package use. Prior Labs documents
  `TABPFN_TOKEN` as the headless / CI path for accepting the model license.

## Suggested Template Image

Use a PyTorch CUDA runtime image so local `tabpfn` can use the GPU directly.
A reasonable starting point is:

```text
pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime
```

## Example Vast Flow

Search offers:

```sh
python C:/Users/mohdm/.codex/skills/vast-docker-remote-compute/scripts/vast_probe.py \
  --api-key "$VAST_API_KEY" \
  offers \
  --offer-type ondemand \
  --verified \
  --min-reliability 0.995 \
  --min-gpu-ram-gb 16 \
  --min-direct-ports 2 \
  --allocated-storage-gb 64 \
  --limit 20
```

Create template:

```sh
python C:/Users/mohdm/.codex/skills/vast-docker-remote-compute/scripts/vast_probe.py \
  --api-key "$VAST_API_KEY" \
  create-template \
  --name tabpfn-local-http \
  --image pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime \
  --env "-e PORT=8000 -e TABPFN_BACKEND=tabpfn-local -p 8000:8000" \
  --onstart-file cloud/vast/tabpfn_onstart.sh \
  --runtype ssh \
  --recommended-disk-space 64
```

Launch instance from that template:

```sh
python C:/Users/mohdm/.codex/skills/vast-docker-remote-compute/scripts/vast_probe.py \
  --api-key "$VAST_API_KEY" \
  create-instance \
  --offer-id <offer_id> \
  --template-hash-id <template_hash_id> \
  --disk-gb 64
```

Destroy instance when finished:

```sh
python C:/Users/mohdm/.codex/skills/vast-docker-remote-compute/scripts/vast_probe.py \
  --api-key "$VAST_API_KEY" \
  destroy-instance \
  --instance-id <instance_id>
```

## One-Shot Controller

For the intended on-demand flow, use
[run_inference_once.py](./run_inference_once.py). It:

1. selects an offer
2. creates an instance from your template
3. waits for SSH
4. tunnels to the remote one-shot HTTP server
5. sends one prediction request
6. destroys the instance in a `finally` block

`run_inference_once.py` injects `TABPFN_TOKEN` as an instance-level env var at
launch time when that variable is present locally.
