#!/usr/bin/env python3
"""Launch a Vast instance, run one inference request, then destroy it."""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request


DEFAULT_BASE_URL = "https://console.vast.ai/api/v0"


def fail(message, payload=None):
    if payload is not None:
        message = f"{message}\n{json.dumps(payload, indent=2)}"
    raise RuntimeError(message)


def read_api_key(value):
    api_key = (value or os.getenv("VAST_API_KEY") or "").strip()
    if not api_key:
        fail("Missing Vast API key. Pass --api-key or set VAST_API_KEY.")
    return api_key


def request(api_key, method, path, payload=None, base_url=DEFAULT_BASE_URL,
            timeout=60.0):
    headers = {"Authorization": f"Bearer {api_key}"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        method=method,
        headers=headers,
        data=data,
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        fail(f"Vast API {method} {path} failed with {exc.code}.",
             {"body": body})

    return json.loads(text) if text.strip() else {}


def choose_offer(api_key, min_gpu_ram_gb, limit):
    payload = {
        "rentable": {"eq": True},
        "rented": {"eq": False},
        "type": "ondemand",
        "verified": {"eq": True},
        "reliability": {"gte": 0.995},
        "num_gpus": {"gte": 1},
        "direct_port_count": {"gte": 2},
        "gpu_total_ram": {"gte": int(min_gpu_ram_gb * 1024)},
        "allocated_storage": 64,
        "limit": limit,
    }
    result = request(api_key, "POST", "/bundles/", payload=payload)
    offers = result if isinstance(result, list) else result.get("offers", [])
    offers = [offer for offer in offers if isinstance(offer, dict)]
    if not offers:
        fail("No suitable Vast offers found.")

    offers.sort(key=lambda item: item.get("dph_total_adj") or
                item.get("dph_total") or 1e9)
    return offers[0]


def create_instance(api_key, offer_id, template_hash_id, disk_gb):
    tabpfn_token = os.getenv("TABPFN_TOKEN")
    payload = {
        "template_hash_id": template_hash_id,
        "disk": disk_gb,
        "target_state": "running",
        "cancel_unavail": True,
    }
    if tabpfn_token:
        payload["env"] = {
            "TABPFN_TOKEN": tabpfn_token,
            "PORT": "8000",
            "TABPFN_BACKEND": "tabpfn-local",
        }
    result = request(api_key, "PUT", f"/asks/{offer_id}/", payload=payload)
    if "new_contract" in result:
        return int(result["new_contract"])
    if "id" in result:
        return int(result["id"])
    fail("Unexpected create-instance response.", result)


def wait_for_instance(api_key, instance_id, timeout_seconds):
    deadline = time.time() + timeout_seconds
    last_seen = None
    while time.time() < deadline:
        result = request(api_key, "GET", f"/instances/{instance_id}/")
        instance = result.get("instances") if isinstance(result, dict) else None
        if instance is None:
            fail(f"Instance {instance_id} disappeared while waiting.")
        last_seen = instance
        status = str(instance.get("actual_status") or
                     instance.get("cur_state") or "").lower()
        ssh_host = instance.get("ssh_host")
        ssh_port = instance.get("ssh_port")
        if status == "running" and ssh_host and ssh_port:
            return instance
        time.sleep(10)

    fail("Timed out waiting for instance readiness.", last_seen)


def destroy_instance(api_key, instance_id):
    return request(api_key, "DELETE", f"/instances/{instance_id}/")


def free_local_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def start_ssh_tunnel(ssh_host, ssh_port, key_file, local_port, remote_port):
    return subprocess.Popen(
        [
            "ssh",
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            "-i",
            key_file,
            "-N",
            "-L",
            f"{local_port}:127.0.0.1:{remote_port}",
            "-p",
            str(ssh_port),
            f"root@{ssh_host}",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )


def wait_for_health(url, timeout_seconds):
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            time.sleep(2)
    fail(f"Timed out waiting for health endpoint: {url}")


def predict_once(url, payload):
    request_obj = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request_obj, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key")
    parser.add_argument("--template-hash-id", required=True)
    parser.add_argument("--ssh-key-file", default=os.path.expanduser(
        "~/.ssh/id_ed25519"))
    parser.add_argument("--disk-gb", type=float, default=64)
    parser.add_argument("--min-gpu-ram-gb", type=float, default=16)
    parser.add_argument("--offer-limit", type=int, default=20)
    parser.add_argument("--timeout-seconds", type=int, default=1800)
    parser.add_argument("--remote-port", type=int, default=8000)
    parser.add_argument(
        "--payload-json",
        required=True,
        help="JSON object sent to /predict",
    )
    args = parser.parse_args()

    api_key = read_api_key(args.api_key)
    payload = json.loads(args.payload_json)
    instance_id = None
    tunnel = None

    try:
        offer = choose_offer(api_key, args.min_gpu_ram_gb, args.offer_limit)
        instance_id = create_instance(
            api_key,
            int(offer["id"]),
            args.template_hash_id,
            args.disk_gb,
        )
        instance = wait_for_instance(api_key, instance_id, args.timeout_seconds)

        local_port = free_local_port()
        tunnel = start_ssh_tunnel(
            instance["ssh_host"],
            int(instance["ssh_port"]),
            args.ssh_key_file,
            local_port,
            args.remote_port,
        )
        wait_for_health(f"http://127.0.0.1:{local_port}/health", 600)
        result = predict_once(f"http://127.0.0.1:{local_port}/predict", payload)
        print(json.dumps(
            {
                "instance_id": instance_id,
                "offer_id": offer["id"],
                "result": result,
            },
            indent=2,
        ))
        return 0
    finally:
        if tunnel is not None:
            tunnel.terminate()
            try:
                tunnel.wait(timeout=10)
            except subprocess.TimeoutExpired:
                tunnel.kill()
        if instance_id is not None:
            try:
                destroy_instance(api_key, instance_id)
            except Exception as exc:
                print(
                    json.dumps(
                        {
                            "warning": "failed to destroy instance",
                            "instance_id": instance_id,
                            "error": str(exc),
                        },
                        indent=2,
                    ),
                    file=sys.stderr,
                )


if __name__ == "__main__":
    raise SystemExit(main())
