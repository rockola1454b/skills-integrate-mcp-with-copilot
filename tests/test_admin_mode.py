import sys
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from app import app


client = TestClient(app)


def test_activities_are_visible_to_students():
    response = client.get("/activities")

    assert response.status_code == 200
    assert "Chess Club" in response.json()


def test_teacher_login_succeeds_with_valid_credentials():
    response = client.post(
        "/auth/login",
        json={"username": "admin", "password": "school123"},
    )

    assert response.status_code == 200
    assert response.json()["username"] == "admin"


def test_signup_requires_teacher_credentials():
    response = client.post(
        "/activities/Chess Club/signup",
        params={"email": f"student-{uuid4()}@example.com"},
    )

    assert response.status_code == 403


def test_teacher_can_sign_up_a_student():
    email = f"student-{uuid4()}@example.com"
    response = client.post(
        f"/activities/Chess Club/signup?email={email}",
        headers={"X-Teacher-Username": "admin", "X-Teacher-Password": "school123"},
    )

    assert response.status_code == 200
    assert "Signed up" in response.json()["message"]
