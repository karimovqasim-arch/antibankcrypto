
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';
import {
  BrowserProvider,
  Contract,
  formatUnits,
  parseUnits
} from 'ethers';

const PROJECT_ID = '11650d5ae464169e12f6eff1d8769c5b';
const ADDRESS = '0x1B8C361E553AcbE735aa433C4d3ee4Ea92A32080';

const ABI = [
  'function balanceOf(address) view returns(uint256)',
  'function decimals() view returns(uint8)',
  'function burnForShares(uint256)',
  'function claim(uint256) returns(uint256)',
  'function currentEpoch() view returns(uint256)',
  'function nextClaimEpoch(address) view returns(uint256)',
  'function sharesAt(address,uint256) view returns(uint256 userShares,uint256 allShares)',
  'function REWARD_PER_EPOCH() view returns(uint256)',
  'function REWARD_EPOCHS() view returns(uint256)',
  'function MAX_CLAIM_EPOCHS() view returns(uint256)'
];

const $ = id => document.getElementById(id);

const status = message => {
  const el = $('status');
  if (el) el.textContent = String(message);
};

const MAX_SCAN = 240;
const DECIMALS = 18;

let account = null;
let contract = null;
let busy = false;
let syncId = 0;
let refreshId = 0;

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

function formatABCR(amount) {
  const value = formatUnits(amount, DECIMALS);
  const [whole, fraction = ''] = value.split('.');
  const grouped = BigInt(whole).toLocaleString('en-US');
  const trimmed = fraction.slice(0, 6).replace(/0+$/, '');
  return grouped + (trimmed ? '.' + trimmed : '');
}

function createRewardsPanel() {
  if ($('abcrRewardsPanel')) return;

  const panel = document.createElement('section');
  panel.id = 'abcrRewardsPanel';

  panel.style.cssText = `
    margin:20px 0;
    padding:20px;
    background:#101a14;
    border:1px solid #327a50;
    border-radius:18px;
    color:#eaffee;
    font-family:Arial,sans-serif;
  `;

  panel.innerHTML = `
    <h3 style="color:#66ff99;margin:0 0 15px">
      ABCR Reward Dashboard
    </h3>

    <div style="display:grid;gap:12px">

      <div>
        <small>Accumulated Rewards</small>
        <div id="rewardTotal"
          style="font-size:24px;color:#66ff99;font-weight:bold">
          —
        </div>
      </div>

      <div>
        <small>Pending Epochs</small>
        <div id="pendingEpochs"
          style="font-size:22px;font-weight:bold">
          —
        </div>
      </div>

      <div>
        <small>Claim Transactions Needed</small>
        <div id="claimTransactions"
          style="font-size:22px;font-weight:bold">
          —
        </div>
      </div>

      <div>
        <small>Next Claim Reward</small>
        <div id="nextReward"
          style="font-size:22px;color:#66ff99;font-weight:bold">
          —
        </div>
      </div>

      <small id="rewardInfo"
        style="color:#a9bcae;line-height:1.5">
        Connect your wallet to calculate rewards.
      </small>

    </div>
  `;

  const anchor = $('next') || $('claim');

  if (anchor) {
    anchor.insertAdjacentElement('afterend', panel);
  } else {
    document.body.appendChild(panel);
  }
}

function setRewardText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function resetRewards() {
  setRewardText('rewardTotal', '—');
  setRewardText('pendingEpochs', '—');
  setRewardText('claimTransactions', '—');
  setRewardText('nextReward', '—');
  setRewardText(
    'rewardInfo',
    'Connect your wallet to calculate rewards.'
  );
}

function updateButtons() {
  $('connect').disabled = false;
  $('connect').textContent =
    account ? 'Change Wallet' : 'Connect Wallet';

  $('disconnect').hidden = !account;
  $('burn').disabled = !contract || busy;
  $('claim').disabled = !contract || busy;
}

function resetWallet() {
  ++refreshId;
  account = null;
  contract = null;

  $('wallet').textContent = 'Not connected';
  $('network').textContent = 'Network: —';
  $('balance').textContent = 'ABCR Balance: —';
  $('epoch').textContent = 'Current epoch: —';
  $('next').textContent = 'Next claim epoch: —';

  resetRewards();
  updateButtons();
}

async function calculateRewards(
  activeContract,
  activeAccount,
  current,
  next,
  requestId
) {
  const [rewardPerEpoch, rewardEpochs, maxClaim] =
    await Promise.all([
      activeContract.REWARD_PER_EPOCH(),
      activeContract.REWARD_EPOCHS(),
      activeContract.MAX_CLAIM_EPOCHS()
    ]);

  const lastExclusive =
    current < rewardEpochs + 1n
      ? current
      : rewardEpochs + 1n;

  if (next === 0n || next >= lastExclusive) {
    if (requestId !== refreshId) return;

    setRewardText('rewardTotal', '0 ABCR');
    setRewardText('pendingEpochs', '0');
    setRewardText('claimTransactions', '0');
    setRewardText('nextReward', '0 ABCR');
    setRewardText(
      'rewardInfo',
      'No completed reward epochs are pending.'
    );
    return;
  }

  const pending = lastExclusive - next;
  const transactions =
    (pending + maxClaim - 1n) / maxClaim;

  if (requestId !== refreshId) return;

  setRewardText('pendingEpochs', pending.toString());
  setRewardText(
    'claimTransactions',
    transactions.toString()
  );

  setRewardText('rewardTotal', 'Calculating...');
  setRewardText('nextReward', 'Calculating...');

  // Limit historical RPC reads to keep the site responsive.
  const scanCount =
    pending > BigInt(MAX_SCAN)
      ? MAX_SCAN
      : Number(pending);

  const nextClaimCount =
    pending > maxClaim
      ? Number(maxClaim)
      : Number(pending);

  let scannedReward = 0n;
  let nextClaimReward = 0n;

  for (let i = 0; i < scanCount; i++) {
    if (requestId !== refreshId) return;

    const epoch = next + BigInt(i);

    const shares = await activeContract.sharesAt(
      activeAccount,
      epoch
    );

    const mine = shares[0];
    const total = shares[1];

    const epochReward =
      total > 0n
        ? rewardPerEpoch * mine / total
        : 0n;

    scannedReward += epochReward;

    if (i < nextClaimCount) {
      nextClaimReward += epochReward;
    }

    if ((i + 1) % 24 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (requestId !== refreshId) return;

  const complete = pending <= BigInt(MAX_SCAN);

  setRewardText(
    'rewardTotal',
    formatABCR(scannedReward) +
      ' ABCR' +
      (complete ? '' : ' (partial)')
  );

  setRewardText(
    'nextReward',
    formatABCR(nextClaimReward) + ' ABCR'
  );

  setRewardText(
    'rewardInfo',
    complete
      ? 'Calculated from all pending completed epochs. BNB gas fees apply.'
      : 'Partial total: only the first ' +
        scanCount +
        ' of ' +
        pending.toString() +
        ' pending epochs were scanned. The actual accumulated reward may be higher. Next Claim reward is calculated separately.'
  );
}

async function refresh() {
  if (!contract || !account) return;

  const requestId = ++refreshId;
  const activeContract = contract;
  const activeAccount = account;

  const [balance, epoch, next] = await Promise.all([
    activeContract.balanceOf(activeAccount),
    activeContract.currentEpoch(),
    activeContract.nextClaimEpoch(activeAccount)
  ]);

  if (requestId !== refreshId) return;

  $('balance').textContent =
    'ABCR Balance: ' + formatABCR(balance);

  $('epoch').textContent =
    'Current epoch: ' + epoch.toString();

  $('next').textContent =
    'Next claim epoch: ' + next.toString();

  try {
    await calculateRewards(
      activeContract,
      activeAccount,
      epoch,
      next,
      requestId
    );
  } catch (error) {
    if (requestId !== refreshId) return;

    setRewardText('rewardTotal', 'Unavailable');
    setRewardText('nextReward', 'Unavailable');
    setRewardText(
      'rewardInfo',
      'Reward calculation failed: ' +
        (error.shortMessage || error.message)
    );
  }
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
      $('network').textContent =
        'Network: Switch to BNB Smart Chain';
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

    const nextContract = new Contract(
      ADDRESS,
      ABI,
      signer
    );

    const decimals = Number(
      await nextContract.decimals()
    );

    if (decimals !== DECIMALS) {
      throw new Error(
        'Unexpected token decimals: ' + decimals
      );
    }

    if (id !== syncId) return;

    account = await signer.getAddress();
    contract = nextContract;

    $('wallet').textContent =
      account.slice(0, 8) +
      '...' +
      account.slice(-6);

    $('network').textContent =
      'Network: BNB Smart Chain';

    updateButtons();

    await refresh();

    if (id === syncId) {
      status('Wallet connected successfully.');
    }

  } catch (error) {
    if (id !== syncId) return;

    status(
      'Wallet error: ' +
      (error.shortMessage || error.message)
    );
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

    if (receipt.status !== 1) {
      throw new Error('Transaction failed');
    }

    status(
      label +
      ' confirmed: https://bscscan.com/tx/' +
      tx.hash
    );

    await refresh();

  } catch (error) {
    status(
      error.shortMessage ||
      error.message ||
      String(error)
    );
  } finally {
    busy = false;
    updateButtons();
  }
}

async function burn() {
  if (!contract || busy) return;

  try {
    const value = $('burnAmount').value.trim();

    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) {
      status('Enter a valid ABCR amount.');
      return;
    }

    const amount = parseUnits(value, DECIMALS);

    if (amount <= 0n) {
      status('Burn amount must be positive.');
      return;
    }

    const balance = await contract.balanceOf(account);

    if (amount > balance) {
      status('Insufficient ABCR balance.');
      return;
    }

    if (!confirm(
      'Permanently burn ' + value + ' ABCR?'
    )) return;

    await sendTransaction(
      'Burn',
      () => contract.burnForShares(amount)
    );

  } catch (error) {
    status(error.shortMessage || error.message);
  }
}

async function claim() {
  if (!contract || busy) return;

  try {
    const count = Number($('count').value);

    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 24
    ) {
      status('Choose 1–24 epochs.');
      return;
    }

    const [current, next] = await Promise.all([
      contract.currentEpoch(),
      contract.nextClaimEpoch(account)
    ]);

    if (next === 0n || next >= current) {
      status('No completed claimable epoch yet.');
      return;
    }

    if (!confirm(
      'Claim rewards for up to ' +
      count +
      ' epochs? BNB gas fees apply.'
    )) return;

    await sendTransaction(
      'Claim',
      () => contract.claim(BigInt(count))
    );

  } catch (error) {
    status(error.shortMessage || error.message);
  }
}

$('connect').onclick = () =>
  appKit.open({ view: 'Connect' });

$('disconnect').onclick = async () => {
  try {
    status('Disconnecting...');

    await appKit.disconnect();

    ++syncId;
    resetWallet();

    status('Wallet disconnected.');

  } catch (error) {
    status(
      'Disconnect error: ' +
      (error.message || String(error))
    );
  }
};

$('burn').onclick = burn;
$('claim').onclick = claim;

createRewardsPanel();
updateButtons();

appKit.subscribeAccount(() => {
  void syncWallet();
});

appKit.subscribeNetwork(() => {
  void syncWallet();
});

status('WalletConnect ready.');
void syncWallet();
