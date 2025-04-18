import fs from 'fs/promises';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { ethers } from 'ethers';

// --- Load wallet list from file ---
async function loadWallets(filename) {
   const data = await fs.readFile(filename, 'utf-8');
   return data
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
}

// --- Main Wallet Handler ---
async function handleWallet(rawPrivateKey, index) {
   const privateKey = `0x${rawPrivateKey}`;
   const wallet = new ethers.Wallet(privateKey);
   const address = await wallet.getAddress();

   console.log(`\n=== [${index + 1}] Wallet: ${address} ===`);

   const jar = new CookieJar();
   const client = wrapper(
      axios.create({
         baseURL: 'https://quest-api.gpu.net/api',
         headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            origin: 'https://token.gpu.net',
            referer: 'https://token.gpu.net/',
         },
         jar,
         withCredentials: true,
      })
   );

   try {
      // Step 1: GET nonce
      const nonceRes = await client.get('/auth/eth/nonce');
      const nonce = nonceRes.data;
      console.log('[1] Got nonce');

      const now = new Date().toISOString();
      const message = `token.gpu.net wants you to sign in with your Ethereum account:\n${address}\n\nSign in with Ethereum to the app.\n\nURI: https://token.gpu.net\nVersion: 1\nChain ID: 4048\nNonce: ${nonce}\nIssued At: ${now}`;
      const signature = await wallet.signMessage(message);
      console.log('[2] Signed message');

      await client.post('/auth/eth/verify', { message, signature });
      console.log('[3] Login success');

      const expRes = await client.get('/users/exp');
      console.log(`[4] EXP: ${expRes.data}`);

      const taskRes = await client.get('/users/social/tasks');
      const tasks = taskRes.data.filter((t) => !t.completed);
      const taskIds = tasks.map((t) => t.id);
      console.log('[5] Tasks:', taskIds);

      for (const id of taskIds) {
         try {
            const res = await client.get(`/users/social/tasks/${id}/verify`);
            console.log(`[6] ✅ Task ${id}: ${res.data.message}`);
            await new Promise((r) => setTimeout(r, 1000));
         } catch (err) {
            console.error(`[6] ❌ Task ${id} error:`, err.response?.data || err.message);
         }
      }

      console.log(`✅ Wallet ${index + 1} done.`);
   } catch (err) {
      console.error(`❌ Wallet ${index + 1} failed:`, err.response?.data || err.message);
   }
}

// --- Main Runner ---
(async () => {
   const wallets = await loadWallets('wallets.txt');

   for (let i = 0; i < wallets.length; i++) {
      await handleWallet(wallets[i], i);
      await new Promise((r) => setTimeout(r, 2000));
   }

   console.log('\n🎉 Semua wallet selesai.');
})();
