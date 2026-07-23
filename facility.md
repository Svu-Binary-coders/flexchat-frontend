# FlexChat - The Digital Safe House

FlexChat is a next-generation, zero-trust, and covert messaging application. It provides a secure communication channel for privacy-conscious individuals (journalists, activists, whistleblowers).

---

## 🧩 Core Architecture

| Layer                   | Description                                        |
| ----------------------- | -------------------------------------------------- |
| **Security Layer**      | Complete encryption and privacy                    |
| **Communication Layer** | Trace-less communication via zero-knowledge server |
| **AI Layer**            | Client-side offline processing                     |
| **Covert Layer**        | Emergency and camouflage features                  |

---

## Key Features

### 🔒 Security

- **E2EE Messaging:** Encryption using Signal protocol
- **File encryption:** Secure file sharing with client-side encryption when user on `enble advance file sharing` in settings
- **Screenshot Block:** Hardware-level screenshot blocking
- **Anti-Surveillance:** Auto-delete logs and Warrant Canary

### 👻 Camouflage Mode

- **Decoy Account:** Display fake chats with incorrect PIN
- **Panic Mode:** Complete data deletion in emergencies

### 🤖 AI Features (Completely Offline)

- Chat summarization
- Smart local search
- Message tone detector

### 🌌 Advanced Privacy

- **Digital Will:** Send data to trusted contacts at specified time
- **Traffic Obfuscation:** Prevent ISP tracking

---

## 🗺️ Development Roadmap

### 🔴 Phase 1: Foundation

- [ ] Anonymous user registration
- [ ] Real-time text messaging
- [ ] Local database encryption
- [ ] E2EE implementation

### 🟡 Phase 2: Safe Haven

- [ ] App lock and PIN system
- [ ] Decoy accounts
- [ ] Automatic message deletion
- [ ] screenshot,copy, paste blocking

### 🔵 Phase 3: Intelligence

- [ ] Encrypted file sharing
- [ ] Audio/video calling
- [ ] Offline AI features

### 🟢 Phase 4: Ghost Protocol

- [ ] Panic Mode
- [ ] Trusted Contacts / Digital Will
- [ ] Traffic Obfuscation

---

## 🛠️ Tech Stack

| Component                             | Technology              |
| ------------------------------------- | ----------------------- |
| **Frontend**                          | Next.js                 |
| Frontend caching and state management | Zustand, TanStack Query |
| **Realtime**                          | Socket.IO client        |
| **UI**                                | Tailwind CSS, Radix UI  |

|**
| **Backend** | Node.js |
| **Mobile** | React Native (iOS & Android Future) |
| **Database** | MongoDB , Redis (caching) |
| **Queue** | BullMQ |
| **Encryption Engine** | web crypto |
| **Encryption** | FCP protocol (own protocol) |
| **AI** | TensorFlow Lite |
| **Real-time** | Secure WebSockets |
| **Calling\*\* | WebRTC |

---

## Setup Guide

### Required Software

- Node.js v18+
- Android Studio / Xcode
- Go v1.20+

### Installation

```bash
git clone https://github.com/binarycoders/backend.git
cd backend
npm install && npm start

cd ../frontend
npm install
npm run dev
```
