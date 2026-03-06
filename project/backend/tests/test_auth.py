"""
Authentication tests.
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Test successful registration."""
    response = await client.post(
        "/auth/register",
        json={
            "personal_email": "test@example.com",
            "password": "testpassword123",
        },
    )
    
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    """Test registration with duplicate email."""
    # First registration
    await client.post(
        "/auth/register",
        json={
            "personal_email": "duplicate@example.com",
            "password": "testpassword123",
        },
    )
    
    # Second registration with same email
    response = await client.post(
        "/auth/register",
        json={
            "personal_email": "duplicate@example.com",
            "password": "anotherpassword",
        },
    )
    
    assert response.status_code == 409
    assert "이미 등록된" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    """Test successful login."""
    # Register first
    await client.post(
        "/auth/register",
        json={
            "personal_email": "login@example.com",
            "password": "testpassword123",
        },
    )
    
    # Login
    response = await client.post(
        "/auth/login",
        json={
            "personal_email": "login@example.com",
            "password": "testpassword123",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    """Test login with wrong password."""
    # Register first
    await client.post(
        "/auth/register",
        json={
            "personal_email": "wrongpass@example.com",
            "password": "correctpassword",
        },
    )
    
    # Login with wrong password
    response = await client.post(
        "/auth/login",
        json={
            "personal_email": "wrongpass@example.com",
            "password": "wrongpassword",
        },
    )
    
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_unauthorized(client: AsyncClient):
    """Test /me endpoint without authentication."""
    response = await client.get("/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_me_authorized(client: AsyncClient):
    """Test /me endpoint with authentication."""
    # Register and get token
    register_response = await client.post(
        "/auth/register",
        json={
            "personal_email": "me@example.com",
            "password": "testpassword123",
        },
    )
    token = register_response.json()["access_token"]
    
    # Get user info
    response = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["personal_email"] == "me@example.com"
    assert data["school_email_verified"] is False

