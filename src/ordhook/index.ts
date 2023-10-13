import { OrdinalsIndexer } from '@hirosystems/ordhook-sdk-js';
import { ENV } from '../env';
import { PgStore } from '../pg/pg-store';
import { BitcoinEvent } from '@hirosystems/chainhook-client';
import PQueue from 'p-queue';

export interface OrdhookBlock {
  block: BitcoinEvent;
}

export function buildOrdhookIndexer(db: PgStore): OrdinalsIndexer {
  const ordhook = new OrdinalsIndexer({
    bitcoinRpcUrl: ENV.BITCOIN_RPC_URL,
    bitcoinRpcUsername: ENV.BITCOIN_RPC_USERNAME,
    bitcoinRpcPassword: ENV.BITCOIN_RPC_PASSWORD,
    workingDir: ENV.ORDHOOK_WORKING_DIR,
    logsEnabled: true,
  });
  const jobQueue = new PQueue({
    concurrency: 1,
    autoStart: true,
  });

  ordhook.onBlock(block => {
    console.log(`Queue size: ${jobQueue.size}`);

    // Early return: if the queue is full, reject the block
    // TODO: Do this using PQueue's limits
    if (jobQueue.size > 10) {
      console.log('Blocking');
      return false;
    }

    // Enqueue
    void jobQueue.add(async () => {
      await db.insertBlock(block as OrdhookBlock);
    });
    return true;
  });

  ordhook.onBlockRollBack(block => {
    console.log(`Queue size: ${jobQueue.size}`);

    // Early return: if the queue is full, reject the block
    // TODO: Do this using PQueue's limits
    if (jobQueue.size > 10) {
      console.log('Blocking');
      return false;
    }

    // Enqueue
    void jobQueue.add(async () => {
      await db.rollBackBlock(block as OrdhookBlock);
    });
    return true;
  });
  return ordhook;
}