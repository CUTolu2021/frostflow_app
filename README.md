# ❄️ FrostFlow: The Retail Operating System

<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/4adbc60c-db75-488d-bd47-03f4cf78ddb8" />

> **Trustless Inventory Reconciliation for High-Volume Retail.**
> FrostFlow is an all-in-one Retail OS that eliminates internal shrinkage by enforcing a double-blind verification protocol between business owners and staff.

---

## 🧐 The Problem

Small business retailers lose money annually to internal shrinkage (theft and administrative error). Existing POS systems rely on "trust" assuming the inventory entry is correct. They fail to catch discrepancies until the end-of-month audit, by which time the trail is cold.

## 🛡️ The Solution: Double-Blind Handshake

FrostFlow introduces a "Nuclear Key" architecture to inventory management:

1. **The Owner** enters stock data (e.g., "Sent 50kg of Chicken").
2. **The Staff** enters stock data blindly (e.g., "Received 48kg").
3. **The System** acts as the impartial arbiter. It locks the inventory levels and flags the mismatch immediately before the stock is available for sale.

---

## 🚀 Key Features

### 🔐 Trustless Verification

* **Blind Entry System:** Staff cannot see "Expected Quantity" when receiving goods.
* **Auto-Reconciliation:** The system automatically cross-references entries at the end of the day.
* **Mismatch Audit:** Discrepancies are logged into a permanent, immutable audit trail.

### 🧠 Intelligent Workflows (n8n)

* **Automated Alerts:** Instead of spamming users, the system uses n8n workflows to batch notifications (e.g., "Daily Summary" vs. "Urgent Mismatch").
* **Anomaly Detection:** Monitoring for suspicious patterns in stock levels.

### ⚡ Real-Time & Offline First

* **Variable Unit Support:** Handles "Catch Weight" inventory (e.g., selling by Box vs. selling by KG) with automatic unit conversion.
* **Live Updates:** Powered by Supabase Realtime, dashboards update instantly without page reloads.

---

## 🏗️ Architecture & Tech Stack

This project is built as a self-hosted, containerized ecosystem designed for data sovereignty and scalability.

| Component | Technology | Role |
| --- | --- | --- |
| **Frontend** | **Angular (v19+)** | Reactive UI, TypeScript, Component Architecture |
| **Backend** | **Supabase** | PostgreSQL, Auth, Row Level Security (RLS), Realtime |
| **Orchestration** | **n8n** | Event-driven workflows, Notification logic, Cron jobs |
| **Infrastructure** | **Docker** | Containerization for consistent deployment |
| **Hosting** | **Coolify / Oracle VPS** | Self-hosted PaaS management |


## 🛠️ Getting Started

### Prerequisites

* Docker & Docker Compose
* Node.js v18+ (for local development)
* A Supabase Project (Free Tier works)

### Installation

1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/frostflow.git
cd frostflow

```


2. **Configure Environment**
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
N8N_WEBHOOK_URL=your_n8n_webhook

```


3. **Run with Docker**
```bash
docker-compose up --build

```


Access the application at `http://localhost:80`.

---

## 🔮 Roadmap

* [x] **Phase 1:** Core Inventory & Double-Blind Verification (Completed)
* [ ] **Phase 2:** AI-Driven "Daily Intelligence Briefing" (In Progress)
* [ ] **Phase 3:** Integrated E-commerce Storefront (Unified Database)
* [ ] **Phase 4:** Mobile App for Barcode Scanning

---

## 👨‍💻 Author

**Omoniyi Tolulope**

* **Portfolio:** https://www.notion.so/Tolulope-Omoniyi-2b044d36684b806eb6a9cdb3ee468af0
* **LinkedIn:** https://www.linkedin.com/in/omoniyi-tolulope/
* **Email:** toluomoniyi24@gmail.com

> *Built with ❤️ to protect small business profits.*
