import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from backend.main import app
from backend.schemas.models import DispatchResponse

from unittest.mock import AsyncMock

@pytest.mark.asyncio
@patch("backend.api.routes._get_driver")
async def test_health_check(mock_get_driver):
    mock_session = AsyncMock()
    mock_driver = AsyncMock()
    mock_driver.session.return_value.__aenter__.return_value = mock_session
    mock_get_driver.return_value = mock_driver
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "blood-dispatch-backend", "neo4j": "connected"}

@pytest.mark.asyncio
async def test_unauthorized_dispatch():
    payload = {
        "hospital_id": "HOSP-123",
        "blood_group": "O+",
        "urgency": "critical",
        "coordinates": {"lat": 12.9716, "lng": 77.5946}
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/dispatch", json=payload)
    assert response.status_code == 401

@pytest.mark.asyncio
@patch("backend.api.routes.find_eligible_donors")
async def test_authorized_dispatch(mock_find_donors):
    mock_find_donors.return_value = [] # Return empty list so it doesn't trigger graph
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_res = await ac.post("/api/auth/token", data={"username": "HOSP-123", "password": "password"})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    
    payload = {
        "hospital_id": "HOSP-123",
        "blood_group": "O+",
        "urgency": "critical",
        "coordinates": {"lat": 12.9716, "lng": 77.5946}
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/dispatch", 
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
    assert response.status_code == 200
    data = response.json()
    assert data["donors_matched"] == 0
    assert "No eligible donors found" in data["message"]
