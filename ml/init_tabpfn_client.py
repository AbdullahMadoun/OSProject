#!/usr/bin/env python3
"""Run one-time TabPFN client login and cache the resulting access token."""

from pathlib import Path

import tabpfn_client


def main():
    token = tabpfn_client.get_access_token()
    tabpfn_client.set_access_token(token)

    cache_path = (
        Path(tabpfn_client.__file__).resolve().parent / ".tabpfn" / "config"
    )
    print(f"TabPFN client token initialized and cached at {cache_path}")


if __name__ == "__main__":
    main()
