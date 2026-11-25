import os
import sys
import time
import json
import statistics
import concurrent.futures
import requests

API_URL = "http://localhost:5000"
RESULTS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "results", "performance_results.json")

def login(email, password):
    res = requests.post(f"{API_URL}/api/v1/auth/login", json={"email": email, "password": password}, timeout=10)
    if res.status_code != 200:
        raise Exception(f"Login failed: {res.text}")
    return res.json()["accessToken"]

def execute_request(url, headers):
    t0 = time.perf_counter()
    status_code = 0
    success = False
    error_msg = None
    try:
        res = requests.get(url, headers=headers, timeout=15)
        status_code = res.status_code
        success = (res.status_code == 200)
        if not success:
            error_msg = f"HTTP {res.status_code}: {res.text[:100]}"
    except Exception as ex:
        error_msg = str(ex)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return {
        "url": url,
        "status_code": status_code,
        "success": success,
        "elapsed_ms": elapsed_ms,
        "error": error_msg
    }

def main():
    print("=== LENDGUARD AI: Reproducible Realistic Multi-User Load & Capacity Test ===")
    
    # Authenticate
    token = login("admin@example.com", "Admin123!")
    headers = {"Authorization": f"Bearer {token}"}
    print("1. Authenticated as Admin successfully.")

    # Define realistic workload mix
    endpoints = [
        f"{API_URL}/api/v1/dashboard/summary",
        f"{API_URL}/api/v1/dashboard/trends?period=daily",
        f"{API_URL}/api/v1/transactions?page=1&pageSize=20",
        f"{API_URL}/api/v1/transactions?search=TXN&page=1&pageSize=10",
        f"{API_URL}/api/v1/exceptions?status=OPEN&page=1&pageSize=20",
        f"{API_URL}/api/v1/exceptions?severity=HIGH&page=1&pageSize=20",
        f"{API_URL}/api/v1/reconciliation-runs?page=1&pageSize=10",
        f"{API_URL}/api/v1/reports/reconciliation?page=1&pageSize=10",
        f"{API_URL}/api/v1/reports/exceptions?page=1&pageSize=10",
        f"{API_URL}/api/v1/audit-logs?page=1&pageSize=20",
        f"{API_URL}/api/v1/users?pageSize=20"
    ]

    total_requests = 150
    concurrency = 10
    print(f"2. Launching realistic workload: {total_requests} requests with concurrency={concurrency} across {len(endpoints)} endpoints...")

    latencies = []
    results_by_endpoint = {ep: [] for ep in endpoints}
    errors = []

    wall_start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = []
        for i in range(total_requests):
            ep = endpoints[i % len(endpoints)]
            futures.append(executor.submit(execute_request, ep, headers))

        for f in concurrent.futures.as_completed(futures):
            res = f.result()
            latencies.append(res["elapsed_ms"])
            results_by_endpoint[res["url"]].append(res)
            if not res["success"]:
                errors.append(res)

    wall_duration = time.perf_counter() - wall_start
    throughput = len(latencies) / wall_duration

    # Calculate percentiles
    latencies.sort()
    p50 = statistics.median(latencies)
    p90 = latencies[int(len(latencies) * 0.90)]
    p95 = latencies[int(len(latencies) * 0.95)]
    p99 = latencies[int(len(latencies) * 0.99)]
    min_lat = min(latencies)
    max_lat = max(latencies)
    mean_lat = statistics.mean(latencies)
    stdev_lat = statistics.stdev(latencies) if len(latencies) > 1 else 0.0

    print("\n=== PERFORMANCE TEST RESULTS ===")
    print(f"Total Requests:       {total_requests}")
    print(f"Successful Requests:  {len(latencies) - len(errors)}")
    print(f"Failed Requests:      {len(errors)} (Error Rate: {len(errors)/total_requests*100:.2f}%)")
    print(f"Total Test Duration:  {wall_duration:.2f} seconds")
    print(f"Measured Throughput:  {throughput:.1f} req/sec")
    print(f"Mean Latency:         {mean_lat:.2f} ms (std dev: {stdev_lat:.2f} ms)")
    print(f"Min Latency:          {min_lat:.2f} ms")
    print(f"P50 Latency (Median): {p50:.2f} ms")
    print(f"P90 Latency:          {p90:.2f} ms")
    print(f"P95 Latency:          {p95:.2f} ms")
    print(f"P99 Latency:          {p99:.2f} ms")
    print(f"Max Latency:          {max_lat:.2f} ms")

    # Endpoint Breakdown Table
    print("\n| Endpoint Pattern               | Samples | Avg Latency | P95 Latency | Success Rate |")
    print("| :----------------------------- | :-----: | :---------: | :---------: | :----------: |")
    for ep, samples in results_by_endpoint.items():
        sub_lat = [s["elapsed_ms"] for s in samples]
        sub_lat.sort()
        ep_name = ep.replace(API_URL, "")
        ep_p95 = sub_lat[int(len(sub_lat) * 0.95)] if sub_lat else 0
        ep_avg = statistics.mean(sub_lat) if sub_lat else 0
        ep_succ = sum(1 for s in samples if s["success"]) / len(samples) * 100 if samples else 0
        print(f"| {ep_name:<30} | {len(samples):>7} | {ep_avg:>9.1f}ms | {ep_p95:>9.1f}ms | {ep_succ:>10.1f}% |")

    # Save to JSON
    os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
    summary_data = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "total_requests": total_requests,
        "concurrency": concurrency,
        "wall_duration_seconds": round(wall_duration, 2),
        "throughput_rps": round(throughput, 1),
        "error_count": len(errors),
        "error_rate_pct": round(len(errors) / total_requests * 100, 2),
        "min_ms": round(min_lat, 2),
        "mean_ms": round(mean_lat, 2),
        "p50_ms": round(p50, 2),
        "p90_ms": round(p90, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "max_ms": round(max_lat, 2),
        "stdev_ms": round(stdev_lat, 2)
    }

    with open(RESULTS_FILE, "w") as f:
        json.dump(summary_data, f, indent=2)

    print(f"\nMachine-readable metrics saved to: {RESULTS_FILE}")

    if len(errors) > 0 or p95 > 2000.0:
        print("[FAIL] Performance threshold breached.")
        sys.exit(1)
    else:
        print("[PASS] Performance and capacity SLA verified successfully.")

if __name__ == "__main__":
    main()
