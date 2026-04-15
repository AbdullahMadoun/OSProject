import os

import numpy as np
import pytest
from sklearn.datasets import load_diabetes
from sklearn.model_selection import train_test_split

from ml.tabpfn_backend import make_regressor


@pytest.mark.skipif(
    not os.getenv("TABPFN_ACCESS_TOKEN"),
    reason="requires TABPFN_ACCESS_TOKEN for live tabpfn-client test",
)
def test_tabpfn_client_live_regression():
    x, y = load_diabetes(return_X_y=True)
    x_train, x_test, y_train, _ = train_test_split(
        x, y, test_size=0.2, random_state=42
    )

    model, metadata = make_regressor(backend="tabpfn-client")
    model.fit(x_train, y_train)
    pred = model.predict(x_test[:4])

    assert metadata["backend"] == "tabpfn-client"
    assert pred.shape == (4,)
    assert np.isfinite(pred).all()
