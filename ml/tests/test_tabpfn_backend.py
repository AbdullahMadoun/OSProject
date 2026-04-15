from pathlib import Path

from sklearn.dummy import DummyRegressor

from ml.tabpfn_backend import configure_client_auth
from ml.tabpfn_backend import make_regressor
from ml.tabpfn_backend import prepare_prediction_backend
from ml.tabpfn_backend import resolve_client_token


class FakeClientModule:
    def __init__(self, root):
        root.mkdir(parents=True, exist_ok=True)
        self.__file__ = str(root / "__init__.py")
        self.captured_token = None
        Path(self.__file__).write_text("# fake\n", encoding="utf-8")

    def set_access_token(self, access_token):
        self.captured_token = access_token

    def get_access_token(self):
        return "interactive-token"


def test_resolve_client_token_from_env(monkeypatch, tmp_path):
    fake = FakeClientModule(tmp_path / "pkg")
    monkeypatch.setenv("TABPFN_ACCESS_TOKEN", "env-token")

    token, source = resolve_client_token(client_module=fake)

    assert token == "env-token"
    assert source == "env"


def test_resolve_client_token_from_cache(monkeypatch, tmp_path):
    fake = FakeClientModule(tmp_path / "pkg")
    cache_path = tmp_path / "pkg" / ".tabpfn" / "config"
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text("cached-token\n", encoding="utf-8")
    monkeypatch.delenv("TABPFN_ACCESS_TOKEN", raising=False)

    token, source = resolve_client_token(client_module=fake)

    assert token == "cached-token"
    assert source == "cache"


def test_configure_client_auth_from_env(monkeypatch, tmp_path):
    fake = FakeClientModule(tmp_path / "pkg")
    monkeypatch.setenv("TABPFN_ACCESS_TOKEN", "env-token")

    _, source = configure_client_auth(client_module=fake)

    assert fake.captured_token == "env-token"
    assert source == "env"


def test_make_regressor_dummy_backend():
    model, metadata = make_regressor(backend="dummy")

    assert isinstance(model, DummyRegressor)
    assert metadata["backend"] == "dummy"


def test_prepare_prediction_backend_dummy_bundle():
    assert prepare_prediction_backend({"backend": "dummy"}) is None
