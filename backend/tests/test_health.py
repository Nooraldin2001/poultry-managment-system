def test_health_endpoint_is_public(api):
    resp = api.get("/api/v1/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "service": "poultryhero-api"}
