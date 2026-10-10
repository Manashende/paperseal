# PaperSeal

**Prove an exam paper stayed sealed.**

PaperSeal puts the fingerprint of an exam paper on Monad before the exam. The paper can only be marked released after the exam start time, and only once enough independent officials approve on chain. Anyone can check the record, and anyone can verify a file against the seal.

Built for Monad Blitz Pune V3.

## Quick links

| | |
|---|---|
| **Live app** | https://paperseal.vercel.app/ |
| **GitHub repo** | https://github.com/Manashende/paperseal |
| **Contract (Monad Testnet)** | [`0x9c7329760ad4c4b43880672c7691b7ffa9ef2ad6`](https://testnet.monadscan.com/address/0x9c7329760ad4c4b43880672c7691b7ffa9ef2ad6) |
| **Contract source (verified)** | [Monadscan, Code tab](https://testnet.monadscan.com/address/0x9c7329760ad4c4b43880672c7691b7ffa9ef2ad6#code) |
| **Network** | Monad Testnet, chain ID `10143` |
| **Deployment** | Frontend on Vercel, smart contract on Monad Testnet |
| **Demo video** | _add link_ |
| **Launch post** | _add link_ |

## The problem

Exam paper leaks are a recurring failure in recruitment and board exams. Today there is no public, tamper-proof way to show that a paper was fixed in advance, that nobody released it early, or that the paper a student received is the one that was approved.

## How it works

1. **Seal.** The exam controller picks the paper file. The browser computes its keccak256 hash, and only the hash goes on chain along with the title, start time, list of officials and the number of approvals needed (the threshold). The file itself never leaves the browser.
2. **Wait.** Until the start time, the contract rejects every approval. This is the early-release protection.
3. **Approve.** After the start time, each official approves from their own wallet. Each official can approve only once, and non-officials are rejected.
4. **Release.** When approvals reach the threshold, the contract marks the exam as released and emits an event.
5. **Verify.** Anyone can pick a file and check it against the sealed hash. A match means the file is exactly the paper that was sealed, and a mismatch means it was changed or is a different file.

### What is enforced on chain

- The paper fingerprint is fixed at creation and cannot be changed.
- Approvals before the start time are rejected.
- Only the listed officials can approve, and each only once.
- Release happens only when the threshold is reached.
- File verification is a public read, so no wallet is needed.

## Smart contract functions

| Function | Type | What it does |
|---|---|---|
| `createExam(title, paperHash, startTime, officials, threshold)` | write | Seals an exam and returns its `examId` |
| `approveRelease(examId)` | write | An official approves release, allowed only after the start time |
| `getExam(examId)` | read | Returns title, hash, start time, threshold, approvals, released flag, creator and officials |
| `verifyPaper(examId, fileHash)` | read | Returns `true` if the file hash matches the sealed hash |
| `hasApproved(examId, address)` | read | Whether an official has already approved |
| `isOfficial(examId, address)` | read | Whether an address is an official for the exam |
| `examCount()` | read | Total number of exams sealed |

Events: `ExamCreated`, `ReleaseApproved`, `ExamReleased`.

## App features

- **Seal a paper:** choose a file, set a start time (with 2 and 5 minute shortcuts for demos), add official addresses and the approvals needed.
- **Track approvals:** a live seal ring that fills as officials approve, a countdown to the start time, per-official status, and an approve button.
- **Verify a paper:** upload any file and compare it with the on-chain seal.
- **Transaction log:** every transaction in the session links to Monadscan.
- Wallet connect with automatic switch to Monad Testnet.

## Run it yourself

### Prerequisites

- Node.js 18 or newer
- MetaMask (or another browser wallet)
- Monad Testnet test tokens (MON) from the Monad testnet faucet, for every wallet you will use

### Setup

```bash
git clone https://github.com/Manashende/paperseal.git
cd paperseal
npm install
npm run dev
```

Open the local URL that Vite prints (usually http://localhost:5173). No environment variables or API keys are needed, because the contract address and RPC are set in `src/contract.js`.

To build for production:

```bash
npm run build
npm run preview
```

### Add Monad Testnet to your wallet

The app prompts you to add and switch to the network automatically. To add it by hand:

| Field | Value |
|---|---|
| Network name | Monad Testnet |
| RPC URL | `https://testnet-rpc.monad.xyz` |
| Chain ID | `10143` |
| Currency symbol | `MON` |
| Block explorer | `https://testnet.monadscan.com` |

## Try the full flow (about 5 minutes)

You need three wallet accounts, each with some test MON for gas: **Board** (the creator), **Official A** and **Official B**.

1. Click **Connect wallet** and connect as **Board** on Monad Testnet.
2. On **Seal**, enter these:
   - Title: `Demo exam`
   - Paper file: any PDF or image
   - Start time: click **In 2 minutes**
   - Official addresses: paste the addresses of Official A and Official B, one per line (not Board)
   - Approvals needed: `2`
3. Click **Seal paper on Monad** and confirm. You will see "Exam #1 is sealed on Monad". Click **Track exam #1**.
4. Before the countdown ends, switch the wallet to **Official A** and click **Approve release**. The contract rejects it, because the exam has not started.
5. After the countdown ends, approve as **Official A**, then switch to **Official B** and approve. The ring fills, turns green, and the status reads **Released**.
6. On **Verify**, enter the exam ID, choose the same file and click **Check against the seal** to get **Match**. Try a different file to get **Mismatch**.

If the page does not pick up the new account after you switch wallets, refresh and click **Connect wallet** again. Every transaction appears under "Your transactions this session" with a Monadscan link.

## Tech stack

- **Smart contract:** Solidity, deployed and verified on Monad Testnet
- **Frontend:** React 18 + Vite, plain JavaScript
- **Chain access:** [viem](https://viem.sh) for reads, writes, event parsing and hashing
- **Hosting:** Vercel

## Project structure

```
src/
  App.jsx        UI and all contract interactions
  App.css        styles
  contract.js    chain config, contract address, ABI
```

## Limitations and roadmap

PaperSeal today proves **integrity, timing and approval**. It does not control **access** to the paper. A hash cannot be turned back into the file, so "released" is a verifiable on-chain fact, not a file delivery.

Planned next steps:

1. Encrypt the paper in the browser with AES-256-GCM before sealing and keep the ciphertext off chain.
2. Split the key among the officials with Shamir's Secret Sharing, so the paper can be decrypted only when the threshold of shares is combined after release.
3. A recover-and-download flow that decrypts the paper and checks it against the on-chain hash.
4. Mainnet deployment.

## Demo Video

- Demo video: https://drive.google.com/file/d/1PDj_4Pma1EzGbOcx6HhxcZ1LcT2iNbgb/view?usp=drive_link

## Built By

Manas Shende - https://www.linkedin.com/in/manas-shende
