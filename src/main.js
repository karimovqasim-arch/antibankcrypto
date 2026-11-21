
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import { BrowserProvider, Contract, formatUnits, parseUnits } from 'ethers';

const PROJECT_ID = '11650d5ae464169e12f6eff1d8769c5b';
const ADDRESS = '0x1B8C361E553AcbE735aa433C4d3ee4Ea92A32080';

const ABI = [
  'function balanceOf(address) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function burnForShares(uint256)',
  'function claim(uint256)',
  'function currentEpoch() view returns(uint256)',
  'function nextClaimEpoch(address) view returns(uint256)'
];

const $ = id => document.getElementById(id);
const status = message => {
  $('status').textContent = String(message);
};

let account = null;
let contract = null;
let busy = false;
let syncId = 0;

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [bsc],
  defaultNetwork: bsc,
  projectId: PROJECT_ID,
  metadata: {
    name: 'AntiBank Crypto',
    description: 'ABCR Wallet & Rewards',
    url: 'https://karimovqasim-arch.github.io/antibankcrypto/',
    icons: [
      'https://karimovqasim-arch.github.io/antibankcrypto/abcr-icon.svg'
    ]
  },
  features: {
    analytics: false,
    email: true,
    socials: ['google']
  }
});

function updateButtons() {
  $('connect').disabled = false;
  $('connect').textContent = account ? 'Change Wallet' : 'Connect Wallet';
  $('disconnect').hidden = !account;
  $('burn').disabled = !contract || busy;
  $('claim').disabled = !contract || busy;
}

function resetWallet() {
  account = null;
  contract = null;
  $('wallet').textContent = 'Not connected';
  $('network').textContent = 'Network: —';
  $('balance').textContent = 'ABCR Balance: —';
  $('epoch').textContent = 'Current epoch: —';
  $('next').textContent = 'Next claim epoch: —';
  updateButtons();
}

async function refresh() {
  if (!contract || !account) return;

  const [balance, epoch, next] = await Promise.all([
    contract.balanceOf(account),
    contract.currentEpoch(),
    contract.nextClaimEpoch(account)
  ]);

  $('balance').textContent = 'ABCR Balance: ' + formatUnits(balance, 18);
  $('epoch').textContent = 'Current epoch: ' + epoch;
  $('next').textContent = 'Next claim epoch: ' + next;
}

async function syncWallet() {
  const id = ++syncId;

  try {
    const address = appKit.getAddress();
    const chainId = appKit.getChainId();

    if (!address) {
      resetWallet();
      return;
    }

    if (Number(chainId) !== 56) {
      resetWallet();
      $('network').textContent = 'Network: Switch to BNB Smart Chain';
      status('Please switch to BNB Smart Chain.');
      return;
    }

    const walletProvider = appKit.getWalletProvider();

    if (!walletProvider) {
      status('Waiting for wallet provider...');
      return;
    }

    const provider = new BrowserProvider(walletProvider);
    const signer = await provider.getSigner();
    const nextContract = new Contract(ADDRESS, ABI, signer);

    const decimals = Number(await nextContract.decimals());
    if (decimals !== 18) {
      throw new Error('Unexpected token decimals: ' + decimals);
    }

    if (id !== syncId) return;

    account = await signer.getAddress();
    contract = nextContract;

    $('wallet').textContent =
      account.slice(0, 8) + '...' + account.slice(-6);
    $('network').textContent = 'Network: BNB Smart Chain';

    updateButtons();
    await refresh();
    status('Wallet connected successfully.');

  } catch (error) {
    if (id !== syncId) return;
    status('Wallet error: ' + (error.shortMessage || error.message));
  }
}

async function sendTransaction(label, callback) {
  if (!contract || busy) return;

  busy = true;
  updateButtons();

  try {
    const tx = await callback();
    status(label + ' submitted: ' + tx.hash);

    const receipt = await tx.wait();
    if (receipt.status !== 1) throw new Error('Transaction failed');

    status(label + ' confirmed: https://bscscan.com/tx/' + tx.hash);
    await refresh();

  } catch (error) {
    status(error.shortMessage || error.message);
  } finally {
    busy = false;
    updateButtons();
  }
}

async function burn() {
  if (!contract) return;

  const value = $('burnAmount').value.trim();

  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) {
    status('Enter a valid ABCR amount.');
    return;
  }

  const amount = parseUnits(value, 18);
  if (amount <= 0n) return;

  const balance = await contract.balanceOf(account);
  if (amount > balance) {
    status('Insufficient ABCR balance.');
    return;
  }

  if (!confirm('Permanently burn ' + value + ' ABCR?')) return;

  await sendTransaction('Burn', () => contract.burnForShares(amount));
}

async function claim() {
  if (!contract) return;

  const count = Number($('count').value);

  if (!Number.isInteger(count) || count < 1 || count > 24) {
    status('Choose 1–24 epochs.');
    return;
  }

  const current = await contract.currentEpoch();
  const next = await contract.nextClaimEpoch(account);

  if (next >= current) {
    status('No completed claimable epoch yet.');
    return;
  }

  if (!confirm('Claim rewards? BNB gas fees apply.')) return;

  await sendTransaction('Claim', () => contract.claim(BigInt(count)));
}

$('connect').onclick = () => appKit.open({ view: 'Connect' });

$('disconnect').onclick = async () => {
  try {
    status('Disconnecting...');
    await appKit.disconnect();
    ++syncId;
    resetWallet();
    status('Wallet disconnected.');
  } catch (error) {
    status('Disconnect error: ' + (error.message || String(error)));
  }
};

$('burn').onclick = burn;
$('claim').onclick = claim;

appKit.subscribeAccount(() => { void syncWallet(); });
appKit.subscribeNetwork(() => { void syncWallet(); });

updateButtons();
status('WalletConnect ready.');
void syncWallet();
