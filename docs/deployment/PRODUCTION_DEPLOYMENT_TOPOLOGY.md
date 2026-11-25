# LENDGUARD AI — Production Deployment Topology & Architecture

**Document Reference:** `docs/deployment/PRODUCTION_DEPLOYMENT_TOPOLOGY.md`  
**Classification:** Enterprise System Architecture  
**Target Release:** Production v2.0-GA  

---

## 1. System Topology Architecture

LENDGUARD AI is structured as a modular, containerized multi-tier application. The architecture enforces strict network isolation between public ingress, internal business services, persistent database storage, and external AI providers.

```mermaid
flowchart TD
    subgraph Public_Internet["Public Internet & Corporate Network"]
        Users["Corporate Analysts & Administrators<br/>(HTTPS / WSS)"]
    end

    subgraph DMZ["DMZ / Ingress Tier"]
        ReverseProxy["Nginx / Cloud Reverse Proxy<br/>Port 443 (TLS Termination, WAF, Rate Limiting)"]
    end

    subgraph App_Tier["Application Tier (Private VPC Subnet 10.0.1.0/24)"]
        SPA["React 18 SPA (Nginx Static Container)<br/>Port 80 (Internal)"]
        API["ASP.NET Core 8 Web API<br/>Port 5000 (Internal)"]
        Worker["C# Background Worker Service<br/>Polling Outbox (FOR UPDATE SKIP LOCKED)"]
        AIService["Python 3.11 FastAPI Advisory Service<br/>Port 8000 (Internal Only)"]
    end

    subgraph Data_Tier["Data & Storage Tier (Private VPC Subnet 10.0.2.0/24)"]
        PG["PostgreSQL 16 High-Availability Cluster<br/>Port 5432 / 5433 (Primary + Read Replica)"]
        Storage["Encrypted Local Persistent Volume<br/>/storage/uploads & /storage/exports"]
    end

    subgraph External_Cloud["External Cloud Providers"]
        LLM["Hosted LLM Provider (Anthropic / OpenAI / Vertex)<br/>(Advisory Explanations Only)"]
    end

    Users -->|HTTPS:443| ReverseProxy
    ReverseProxy -->|Proxy / | SPA
    ReverseProxy -->|Proxy /api/v1/ | API
    API -->|Port 5432| PG
    API -->|Volume Mount| Storage
    API -->|HTTP:8000 + Secret Key| AIService
    Worker -->|Port 5432 (SKIP LOCKED)| PG
    Worker -->|Volume Mount| Storage
    Worker -->|HTTP:8000 + Secret Key| AIService
    AIService -.->|Egress HTTPS (No PII)| LLM
```

---

## 2. Hardware Sizing & Capacity Guidelines

| Component | Minimum Specification | Recommended Production Spec | Scaling Strategy |
| :--- | :--- | :--- | :--- |
| **Reverse Proxy (Nginx)** | 2 vCPU, 2 GB RAM | 4 vCPU, 4 GB RAM | Active-passive failover with Keepalived / Cloud Load Balancer |
| **ASP.NET Core Web API** | 2 vCPU, 4 GB RAM | 4 vCPU, 8 GB RAM | Horizontal scaling behind load balancer (Stateless JWT) |
| **C# Background Worker** | 2 vCPU, 4 GB RAM | 4 vCPU, 8 GB RAM | Multi-instance competing consumers (`FOR UPDATE SKIP LOCKED`) |
| **Python AI Advisory** | 1 vCPU, 2 GB RAM | 2 vCPU, 4 GB RAM | Horizontal stateless scaling (Async Uvicorn workers) |
| **PostgreSQL 16 Cluster** | 4 vCPU, 16 GB RAM, 200 GB SSD | 8 vCPU, 32 GB RAM, 1 TB NVMe (3000+ IOPS) | Primary with synchronous streaming replication + read replica |
| **File Storage Volume** | 50 GB SSD | 500 GB Provisioned IOPS Volume | Encrypted persistent volume mount (AES-256) |

---

## 3. Network Security Zoning & Firewall Rules

1. **DMZ (Ingress):**
   - Port `443` (HTTPS) open to corporate VPN or authorized IP ranges.
   - Port `80` (HTTP) strictly redirects to HTTPS (`301 Moved Permanently`).
2. **Application Subnet:**
   - Ingress strictly permitted from Reverse Proxy.
   - Inter-service communication: Only Web API and Worker may connect to AI Service on port `8000` via mutual `X-Service-Key`.
   - Direct internet ingress to ports `5000`, `8000`, or `5173` is blocked.
3. **Data Subnet:**
   - PostgreSQL port `5432/5433` accessible ONLY from Web API and Worker private IP addresses.
   - All external ingress strictly denied.
4. **Egress Firewall:**
   - Only the AI microservice is permitted egress on Port 443 to the hosted LLM provider endpoint.
   - Zero outbound egress to payment gateways or banking transaction networks (Read-only financial boundary).
