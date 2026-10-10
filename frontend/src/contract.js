import { defineChain } from 'viem'

export const CHAIN_ID = 10143
export const CHAIN_HEX = '0x279f'
export const EXPLORER = 'https://testnet.monadscan.com'

// Deployed + verified PaperSeal contract on Monad Testnet
export const CONTRACT_ADDRESS = '0x9c7329760ad4c4b43880672c7691b7ffa9ef2ad6'

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monadscan', url: EXPLORER } },
})

export const ABI = [
  {
    type: 'function',
    name: 'createExam',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'title', type: 'string' },
      { name: 'paperHash', type: 'bytes32' },
      { name: 'startTime', type: 'uint64' },
      { name: 'officials', type: 'address[]' },
      { name: 'threshold', type: 'uint8' },
    ],
    outputs: [{ name: 'examId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approveRelease',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'examId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getExam',
    stateMutability: 'view',
    inputs: [{ name: 'examId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'title', type: 'string' },
          { name: 'paperHash', type: 'bytes32' },
          { name: 'startTime', type: 'uint64' },
          { name: 'threshold', type: 'uint8' },
          { name: 'approvals', type: 'uint8' },
          { name: 'released', type: 'bool' },
          { name: 'creator', type: 'address' },
          { name: 'officials', type: 'address[]' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'verifyPaper',
    stateMutability: 'view',
    inputs: [
      { name: 'examId', type: 'uint256' },
      { name: 'fileHash', type: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'examCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isOfficial',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'hasApproved',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    name: 'ExamCreated',
    inputs: [
      { name: 'examId', type: 'uint256', indexed: true },
      { name: 'title', type: 'string', indexed: false },
      { name: 'paperHash', type: 'bytes32', indexed: false },
      { name: 'startTime', type: 'uint64', indexed: false },
      { name: 'threshold', type: 'uint8', indexed: false },
      { name: 'creator', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReleaseApproved',
    inputs: [
      { name: 'examId', type: 'uint256', indexed: true },
      { name: 'official', type: 'address', indexed: true },
      { name: 'approvals', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ExamReleased',
    inputs: [
      { name: 'examId', type: 'uint256', indexed: true },
      { name: 'releasedAt', type: 'uint64', indexed: false },
    ],
  },
]