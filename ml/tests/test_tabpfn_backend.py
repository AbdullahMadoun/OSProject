from sklearn.dummy import DummyRegressor

from ml.tabpfn_backend import make_regressor
from ml.tabpfn_backend import prepare_prediction_backend


def test_make_regressor_dummy_backend():
    model, metadata = make_regressor(backend="dummy")

    assert isinstance(model, DummyRegressor)
    assert metadata["backend"] == "dummy"


def test_prepare_prediction_backend_dummy_bundle():
    assert prepare_prediction_backend({"backend": "dummy"}) is None
