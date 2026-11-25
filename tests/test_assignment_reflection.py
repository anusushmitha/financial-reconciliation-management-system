import requests

API_URL = "http://localhost:5000"

def login(email, password):
    res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        raise Exception(f"Failed to login {email}: {res.text}")
    return res.json()["accessToken"], res.json()["user"]

def main():
    print("1. Testing Login as Staging Operational Analyst...")
    analyst_token, analyst_user = login("staging.analyst@lendguard.internal", "StagingAnalyst_Secure2026!")
    headers_analyst = {"Authorization": f"Bearer {analyst_token}"}

    print(f"   User: {analyst_user['fullName']} (ID: {analyst_user['id']}, Role: {analyst_user['role']})")

    # Test: Assigned to Me tab query
    res_mine = requests.get(f"{API_URL}/api/v1/exceptions?status=ACTIVE&assignedTo={analyst_user['id']}", headers=headers_analyst)
    items_mine = res_mine.json().get("items", [])
    print(f"   Assigned to Me count: {len(items_mine)}")
    for item in items_mine:
        assert item["assignedTo"]["id"] == analyst_user["id"], f"Leaked non-assigned exception: {item}"
        print(f"     - Found assigned exception: {item['id']} | Status: {item['status']} | Assignee: {item['assignedTo']['fullName']}")
    assert len(items_mine) > 0, "Expected at least 1 assigned exception for operational analyst"

    print("\n2. Testing Assigned Exceptions for anu sushmitha...")
    res_anu = requests.get(f"{API_URL}/api/v1/exceptions?status=ACTIVE&assignedTo=0bacefdb-b578-4289-8667-c6ff227df176", headers=headers_analyst)
    items_anu = res_anu.json().get("items", [])
    print(f"   Assigned to anu sushmitha count: {len(items_anu)}")
    for item in items_anu:
        assert item["assignedTo"]["id"] == "0bacefdb-b578-4289-8667-c6ff227df176"
        print(f"     - Found assigned exception: {item['id']} | Status: {item['status']} | Assignee: {item['assignedTo']['fullName']}")
    assert len(items_anu) > 0, "Expected at least 1 assigned exception for anu sushmitha"

    print("\n3. Testing Unassigned Queue Query...")
    res_unassigned = requests.get(f"{API_URL}/api/v1/exceptions?status=ACTIVE&unassignedOnly=true", headers=headers_analyst)
    items_unassigned = res_unassigned.json().get("items", [])
    print(f"   Unassigned count: {len(items_unassigned)}")
    for item in items_unassigned:
        assert item["assignedTo"] is None, f"Assigned item in unassigned queue: {item}"
    print("   All items in unassigned queue strictly have assignedTo == null.")

    print("\n4. Testing Dynamic Assignment Reflection by Admin...")
    admin_token, admin_user = login("staging.admin@lendguard.internal", "StagingAdmin_Secure2026!")
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    # Pick an unassigned exception
    target_exc = items_unassigned[0]["id"]
    print(f"   Assigning exception {target_exc} to anu sushmitha (0bacefdb-b578-4289-8667-c6ff227df176)...")
    assign_res = requests.patch(f"{API_URL}/api/v1/exceptions/{target_exc}/assignment", headers=headers_admin, json={"assignedTo": "0bacefdb-b578-4289-8667-c6ff227df176"})
    assert assign_res.status_code == 200, f"Assign failed: {assign_res.text}"

    # Verify reflection in anu sushmitha queue
    verify_res = requests.get(f"{API_URL}/api/v1/exceptions?status=ACTIVE&assignedTo=0bacefdb-b578-4289-8667-c6ff227df176", headers=headers_admin)
    verify_items = verify_res.json().get("items", [])
    matching = [x for x in verify_items if x["id"] == target_exc]
    assert len(matching) == 1, "Newly assigned exception was not found in analyst assigned list!"
    print(f"   SUCCESS! Exception {target_exc} immediately reflected in anu sushmitha assigned list! (Assignee: {matching[0]['assignedTo']['fullName']})")

    print("\n=== ALL ASSIGNMENT & SCOPING VERIFICATIONS PASSED 100% ===")

if __name__ == "__main__":
    main()
