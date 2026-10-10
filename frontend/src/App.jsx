import { useEffect, useState } from 'react'
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  keccak256,
  parseEventLogs,
  isAddress,
  getAddress,
  formatEther,
} from 'viem'
import {
  monadTestnet,
  CONTRACT_ADDRESS,
  ABI,
  EXPLORER,
  CHAIN_ID,
  CHAIN_HEX,
} from './contract'
import './App.css'

const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
  pollingInterval: 1000,
})

const walletClient = () =>
  createWalletClient({ chain: monadTestnet, transport: custom(window.ethereum) })

const short = (a) => `${a.slice(0, 6)}…${a.slice(-4)}`

function niceError(e) {
  const reason = e?.walk?.((x) => x?.reason)?.reason
  return reason || e?.shortMessage || e?.message || String(e)
}

async function hashFile(file) {
  const buf = await file.arrayBuffer()
  return keccak256(new Uint8Array(buf))
}

function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = s % 60
  if (h > 0) return `${h}h ${m}m ${x}s`
  if (m > 0) return `${m}m ${x}s`
  return `${x}s`
}

async function readExam(id) {
  const ex = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'getExam',
    args: [BigInt(id)],
  })
  if (ex.startTime === 0n) throw new Error(`No exam found with ID ${id}.`)
  const approvedFlags = await Promise.all(
    ex.officials.map((o) =>
      publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'hasApproved',
        args: [BigInt(id), o],
      }),
    ),
  )
  return { ...ex, id: Number(id), approvedFlags }
}

/* ---------- Icons ---------- */

const ICON_PATHS = {
  create: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  track: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  verify: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zM9 12l2 2 4-4',
}

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

/* ---------- Seal ring ---------- */

function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function arcPath(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0)
  const [x1, y1] = polar(cx, cy, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

function Seal({ flags, threshold, approvals, state }) {
  const total = flags.length
  const size = 240
  const c = size / 2
  const r = 88
  const span = 360 / total
  const gap = total > 1 ? 14 : 0
  return (
    <svg
      className={`seal seal-${state}`}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${approvals} of ${threshold} approvals`}
    >
      <circle cx={c} cy={c} r={r + 22} className="seal-plate" />
      {flags.map((on, i) => {
        const a0 = i * span + gap / 2
        const a1 = total === 1 ? 359.9 : (i + 1) * span - gap / 2
        return (
          <path
            key={i}
            d={arcPath(c, c, r, a0, a1)}
            className={on ? 'seg seg-on' : 'seg'}
          />
        )
      })}
      <text x={c} y={c + 6} textAnchor="middle" className="seal-count">
        {state === 'released' ? 'Open' : `${approvals}/${threshold}`}
      </text>
      <text x={c} y={c + 32} textAnchor="middle" className="seal-sub">
        {state === 'released' ? 'paper released' : 'approvals'}
      </text>
    </svg>
  )
}

/* ---------- App ---------- */

export default function App() {
  const [tab, setTab] = useState('create')
  const [account, setAccount] = useState(null)
  const [chainId, setChainId] = useState(null)
  const [balance, setBalance] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState('')
  const [activity, setActivity] = useState([])
  const [now, setNow] = useState(Date.now())

  // create
  const [title, setTitle] = useState('')
  const [paperHash, setPaperHash] = useState('')
  const [paperName, setPaperName] = useState('')
  const [startAt, setStartAt] = useState('')
  const [officialsText, setOfficialsText] = useState('')
  const [threshold, setThreshold] = useState(2)

  // track
  const [examInput, setExamInput] = useState('')
  const [trackId, setTrackId] = useState(null)
  const [exam, setExam] = useState(null)
  const [loadErr, setLoadErr] = useState('')

  // verify
  const [verifyId, setVerifyId] = useState('')
  const [verifyFile, setVerifyFile] = useState(null)
  const [verifyResult, setVerifyResult] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const eth = window.ethereum
    if (!eth) return
    eth.request({ method: 'eth_accounts' }).then((a) => setAccount(a[0] || null)).catch(() => {})
    eth.request({ method: 'eth_chainId' }).then((c) => setChainId(parseInt(c, 16))).catch(() => {})
    const onAcc = (a) => setAccount(a[0] || null)
    const onChain = (c) => setChainId(parseInt(c, 16))
    eth.on('accountsChanged', onAcc)
    eth.on('chainChanged', onChain)
    return () => {
      eth.removeListener('accountsChanged', onAcc)
      eth.removeListener('chainChanged', onChain)
    }
  }, [])

  // wallet balance for the header card (refreshes after each transaction)
  useEffect(() => {
    if (!account) {
      setBalance(null)
      return
    }
    let stop = false
    publicClient
      .getBalance({ address: account })
      .then((b) => {
        if (!stop) setBalance(b)
      })
      .catch(() => {})
    return () => {
      stop = true
    }
  }, [account, activity.length])

  useEffect(() => {
    if (!trackId) return
    let stop = false
    const run = async () => {
      try {
        const ex = await readExam(trackId)
        if (!stop) {
          setExam(ex)
          setLoadErr('')
        }
      } catch (e) {
        if (!stop) {
          setExam(null)
          setLoadErr(niceError(e))
        }
      }
    }
    run()
    const t = setInterval(run, 4000)
    return () => {
      stop = true
      clearInterval(t)
    }
  }, [trackId])

  async function switchChain() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_HEX }],
      })
    } catch (e) {
      if (e?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: CHAIN_HEX,
              chainName: 'Monad Testnet',
              nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
              rpcUrls: ['https://testnet-rpc.monad.xyz'],
              blockExplorerUrls: [EXPLORER],
            },
          ],
        })
      } else {
        throw e
      }
    }
  }

  async function connect() {
    try {
      if (!window.ethereum) throw new Error('No wallet found. Install MetaMask and reload.')
      const [addr] = await window.ethereum.request({ method: 'eth_requestAccounts' })
      setAccount(addr)
      await switchChain()
      setNotice(null)
    } catch (e) {
      setNotice({ kind: 'error', msg: niceError(e) })
    }
  }

  async function sendTx(label, functionName, args) {
    if (!account) throw new Error('Connect your wallet first.')
    if (chainId !== CHAIN_ID) await switchChain()
    const hash = await walletClient().writeContract({
      address: CONTRACT_ADDRESS,
      abi: ABI,
      functionName,
      args,
      account,
    })
    setActivity((a) => [{ label, hash }, ...a])
    setNotice({ kind: 'info', msg: `${label} sent. Waiting for confirmation…` })
    const receipt = await publicClient.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error('The transaction failed on chain.')
    return { hash, receipt }
  }

  async function onPaperChosen(file) {
    if (!file) return
    setPaperName(file.name)
    setPaperHash(await hashFile(file))
  }

  function setStartIn(minutes) {
    setStartAt(toLocalInput(new Date(Date.now() + minutes * 60 * 1000)))
  }

  async function createExam() {
    setNotice(null)
    try {
      if (!account) throw new Error('Connect your wallet first.')
      if (!title.trim()) throw new Error('Enter an exam title.')
      if (!paperHash) throw new Error('Choose the paper file to seal.')
      const startTs = Math.floor(new Date(startAt).getTime() / 1000)
      if (!startAt || Number.isNaN(startTs)) throw new Error('Pick a start time.')
      const list = officialsText.split(/[\s,;]+/).filter(Boolean)
      if (!list.length) throw new Error('Add at least one official address.')
      if (list.some((a) => !isAddress(a, { strict: false })))
        throw new Error('One of the official addresses is not valid.')
      const officials = list.map((a) => getAddress(a.toLowerCase()))
      if (new Set(officials).size !== officials.length)
        throw new Error('Each official address must be unique.')
      const n = Number(threshold)
      if (!Number.isInteger(n) || n < 1 || n > officials.length)
        throw new Error(`Approvals needed must be between 1 and ${officials.length}.`)

      setBusy('create')
      const { receipt } = await sendTx('Create exam', 'createExam', [
        title.trim(),
        paperHash,
        BigInt(startTs),
        officials,
        n,
      ])
      const [log] = parseEventLogs({ abi: ABI, logs: receipt.logs, eventName: 'ExamCreated' })
      const id = log ? Number(log.args.examId) : null
      setNotice({
        kind: 'ok',
        msg: id ? `Exam #${id} is sealed on Monad.` : 'Exam sealed on Monad.',
      })
      if (id) {
        setExamInput(String(id))
        setVerifyId(String(id))
      }
    } catch (e) {
      setNotice({ kind: 'error', msg: niceError(e) })
    } finally {
      setBusy('')
    }
  }

  function loadExam(id) {
    const n = Number(id)
    if (!Number.isInteger(n) || n < 1) {
      setNotice({ kind: 'error', msg: 'Enter an exam ID of 1 or higher.' })
      return
    }
    setNotice(null)
    setExam(null)
    setLoadErr('')
    setTrackId(n)
    setTab('track')
  }

  async function approve() {
    setNotice(null)
    try {
      setBusy('approve')
      await sendTx(`Approve exam #${trackId}`, 'approveRelease', [BigInt(trackId)])
      setExam(await readExam(trackId))
      setNotice({ kind: 'ok', msg: 'Your approval is recorded on chain.' })
    } catch (e) {
      setNotice({ kind: 'error', msg: niceError(e) })
    } finally {
      setBusy('')
    }
  }

  async function checkPaper() {
    setNotice(null)
    setVerifyResult(null)
    try {
      const idNum = Number(verifyId)
      if (!Number.isInteger(idNum) || idNum < 1) throw new Error('Enter an exam ID of 1 or higher.')
      if (!verifyFile) throw new Error('Choose the paper file to check.')
      setBusy('verify')
      const h = await hashFile(verifyFile)
      const ex = await readExam(idNum)
      const ok = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'verifyPaper',
        args: [BigInt(idNum), h],
      })
      setVerifyResult({ ok, h, committed: ex.paperHash, title: ex.title, id: idNum })
    } catch (e) {
      setNotice({ kind: 'error', msg: niceError(e) })
    } finally {
      setBusy('')
    }
  }

  /* derived */
  const startMs = exam ? Number(exam.startTime) * 1000 : 0
  const state = !exam ? null : exam.released ? 'released' : now >= startMs ? 'open' : 'sealed'
  const isOfficial =
    exam && account && exam.officials.some((o) => o.toLowerCase() === account.toLowerCase())
  const wrongChain = account && chainId !== null && chainId !== CHAIN_ID
  const balanceText =
    balance !== null ? Number(formatEther(balance)).toFixed(4) : '0.0000'

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          PaperSeal
        </div>
        <div className="wallet">
          {account ? (
            <span className="pill mono">{short(account)}</span>
          ) : (
            <button className="btn primary" onClick={connect}>
              Connect wallet
            </button>
          )}
        </div>
      </header>

      <section className="wallet-card">
        <div className="wc-top">
          <span className="wc-net">
            <span className="dot" aria-hidden="true" />
            Monad Testnet
          </span>
          {account && <span className="mono">{short(account)}</span>}
        </div>
        <p className="wc-label">Your available balance</p>
        <div className="wc-balance">
          {balanceText} <span>MON</span>
        </div>
        <p className="wc-tag">
          Prove an exam paper stayed sealed. The fingerprint goes on chain before the exam and the
          paper is released only after enough officials approve.
        </p>
      </section>

      {wrongChain && (
        <div className="notice error">
          Your wallet is on a different network.{' '}
          <button className="linkbtn" onClick={switchChain}>
            Switch to Monad Testnet
          </button>
        </div>
      )}
      {notice && <div className={`notice ${notice.kind}`}>{notice.msg}</div>}

      <nav className="actions" role="tablist">
        {[
          ['create', 'Seal'],
          ['track', 'Track'],
          ['verify', 'Verify'],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className="action"
            onClick={() => setTab(id)}
          >
            <span className="action-ic">
              <Icon name={id} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'create' && (
        <section className="panel">
          <div className="field">
            <label htmlFor="title">Exam title</label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recruitment exam, paper 1"
            />
          </div>

          <div className="field">
            <label htmlFor="paper">Paper file</label>
            <input id="paper" type="file" onChange={(e) => onPaperChosen(e.target.files[0])} />
            {paperHash && (
              <span className="hint">
                Fingerprint of {paperName}: <span className="mono">{paperHash}</span>. The file
                itself never leaves your browser.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="start">Start time</label>
            <div className="row">
              <input
                id="start"
                type="datetime-local"
                step="1"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
              <button className="btn ghost" onClick={() => setStartIn(2)}>
                In 2 minutes
              </button>
              <button className="btn ghost" onClick={() => setStartIn(5)}>
                In 5 minutes
              </button>
            </div>
          </div>

          <div className="field">
            <label htmlFor="officials">Official addresses</label>
            <textarea
              id="officials"
              rows={4}
              value={officialsText}
              onChange={(e) => setOfficialsText(e.target.value)}
              placeholder="One wallet address per line"
            />
          </div>

          <div className="field narrow">
            <label htmlFor="threshold">Approvals needed</label>
            <input
              id="threshold"
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>

          <div className="row">
            <button className="btn primary" disabled={busy === 'create'} onClick={createExam}>
              {busy === 'create' ? 'Sealing…' : 'Seal paper on Monad'}
            </button>
            {examInput && (
              <button className="btn ghost" onClick={() => loadExam(examInput)}>
                Track exam #{examInput}
              </button>
            )}
          </div>
        </section>
      )}

      {tab === 'track' && (
        <section className="panel">
          <div className="row">
            <input
              className="idinput"
              inputMode="numeric"
              value={examInput}
              onChange={(e) => setExamInput(e.target.value)}
              placeholder="Exam ID"
              aria-label="Exam ID"
            />
            <button className="btn primary" onClick={() => loadExam(examInput)}>
              Load exam
            </button>
          </div>

          {!trackId && <p className="muted">Enter an exam ID to see its approvals.</p>}
          {loadErr && <p className="muted">{loadErr}</p>}

          {exam && (
            <div className="track">
              <Seal
                flags={exam.approvedFlags}
                threshold={exam.threshold}
                approvals={exam.approvals}
                state={state}
              />
              <div className="detail">
                <h2>
                  {exam.title} <span className="muted">#{exam.id}</span>
                </h2>
                <p className="statusline">
                  {state === 'sealed' &&
                    `Sealed. Approvals open in ${fmtCountdown(startMs - now)}.`}
                  {state === 'open' &&
                    `Approvals are open. ${exam.approvals} of ${exam.threshold} needed.`}
                  {state === 'released' &&
                    `Released after ${exam.threshold} official approvals.`}
                </p>
                <p className="muted">
                  Starts {new Date(startMs).toLocaleString()}. Paper fingerprint:{' '}
                  <span className="mono">{exam.paperHash}</span>
                </p>

                <ul className="officials">
                  {exam.officials.map((o, i) => (
                    <li key={o}>
                      <span className="mono">
                        {short(o)}
                        {account && o.toLowerCase() === account.toLowerCase() && ' (you)'}
                      </span>
                      <span className={exam.approvedFlags[i] ? 'tag done' : 'tag'}>
                        {exam.approvedFlags[i] ? 'Approved' : 'Waiting'}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="row">
                  <button
                    className="btn primary"
                    disabled={busy === 'approve' || exam.released || !account}
                    onClick={approve}
                  >
                    {busy === 'approve' ? 'Approving…' : 'Approve release'}
                  </button>
                  {account && !isOfficial && !exam.released && (
                    <span className="hint">
                      This wallet is not an official for this exam, so the contract will reject it.
                    </span>
                  )}
                  {!account && <span className="hint">Connect a wallet to approve.</span>}
                </div>
                {state === 'sealed' && (
                  <p className="hint">
                    Approving before the start time is rejected by the contract.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'verify' && (
        <section className="panel">
          <div className="field narrow">
            <label htmlFor="vid">Exam ID</label>
            <input
              id="vid"
              inputMode="numeric"
              value={verifyId}
              onChange={(e) => setVerifyId(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="vfile">Paper file to check</label>
            <input
              id="vfile"
              type="file"
              onChange={(e) => {
                setVerifyFile(e.target.files[0] || null)
                setVerifyResult(null)
              }}
            />
          </div>
          <div className="row">
            <button className="btn primary" disabled={busy === 'verify'} onClick={checkPaper}>
              {busy === 'verify' ? 'Checking…' : 'Check against the seal'}
            </button>
          </div>

          {verifyResult && (
            <div className="result">
              <div className={verifyResult.ok ? 'verdict match' : 'verdict mismatch'}>
                {verifyResult.ok ? 'Match' : 'Mismatch'}
              </div>
              <p>
                {verifyResult.ok
                  ? `This file is exactly the paper sealed for ${verifyResult.title}.`
                  : `This file is not the paper sealed for ${verifyResult.title}. It was changed or is a different file.`}
              </p>
              <p className="muted">
                Sealed fingerprint: <span className="mono">{verifyResult.committed}</span>
                <br />
                This file: <span className="mono">{verifyResult.h}</span>
              </p>
            </div>
          )}
        </section>
      )}

      {activity.length > 0 && (
        <section className="activity">
          <h3>Your transactions this session</h3>
          <ul>
            {activity.map((a) => (
              <li key={a.hash}>
                {a.label}{' '}
                <a href={`${EXPLORER}/tx/${a.hash}`} target="_blank" rel="noreferrer">
                  View on Monadscan
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="foot">
        Running on Monad Testnet. Contract{' '}
        <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
          <span className="mono">{CONTRACT_ADDRESS}</span>
        </a>
      </footer>
    </div>
  )
}