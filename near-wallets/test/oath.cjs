const { test } = require('node:test');
const assert = require('node:assert/strict');
const near = require('near-api-js');
const { sha256 } = require('@noble/hashes/sha256');
const { createOathWallet, OATH_METHODS, buffer } = require('../.oath-test/oath/connector');
const { pairOath } = require('../.oath-test/oath/pairing');
const key = near.KeyPair.fromRandom('ed25519'); // disposable, in-memory key
const account = { accountId: 'tester.testnet', publicKey: key.getPublicKey().toString() };
const call = { receiverId: 'wrap.testnet', actions: [{ type: 'FunctionCall', params: { methodName: 'near_deposit', args: {}, gas: '30000000000000', deposit: '1' } }] };
function harness() {
  const stored = new Map(), requests = [], sent = [], queries = [];
  const session = { topic: 'oath-session', pairingTopic: 'pairing', namespaces: { near: { accounts: ['near:testnet:tester.testnet'], methods: OATH_METHODS } } };
  const state = { session, result: null, nonce: 9007199254740990, outcome: { status: { SuccessValue: '' } } };
  const deps = {
    storage: { get: async k => stored.get(k), set: async(k,v) => stored.set(k,v), remove: async k => stored.delete(k) },
    pair: async network => { assert.equal(network,'testnet'); return state.session; },
    bridge: {
      getSession: async ({ topic }) => { assert.equal(topic,'oath-session'); return state.session; },
      disconnect: async ({ topic }) => { assert.equal(topic,'oath-session'); state.session = null; },
      request: async request => {
        requests.push(request); assert.equal(request.topic,'oath-session'); assert.equal(request.chainId,'near:testnet');
        const { method, params } = request.request;
        if (method === 'near_getAccounts') return [account];
        if (state.result) return state.result;
        const sign = value => {
          assert.equal(value.type,'Buffer'); const bytes = Uint8Array.from(value.data);
          const tx = near.transactions.Transaction.decode(bytes);
          const signature = new near.transactions.Signature({ keyType:0, data:key.sign(sha256(bytes)).signature });
          return buffer(new near.transactions.SignedTransaction({ transaction:tx, signature }).encode());
        };
        return method === 'near_signTransactions' ? params.transactions.map(sign) : sign(params.transaction);
      }
    },
    rpc: network => ({
      query: async params => { queries.push({network,params}); return { nonce:state.nonce, permission:'FullAccess', block_hash:near.utils.serialize.base_encode(new Uint8Array(32).fill(3)) }; },
      sendJsonRpc: async(method,params) => { assert.equal(method,'broadcast_tx_commit'); sent.push(near.transactions.SignedTransaction.decode(Buffer.from(params[0],'base64'))); return state.outcome; }
    })
  };
  return { wallet:createOathWallet(deps), deps, state, stored, requests, sent, queries };
}
test('connect, restore exact topic, sign function call and disconnect', async () => {
  const h=harness(); assert.deepEqual(await h.wallet.getAccounts({network:'testnet'}),[]);
  assert.deepEqual(await h.wallet.signIn({network:'testnet'}),[account]);
  await h.wallet.signAndSendTransaction({...call,network:'testnet'});
  assert.equal(h.sent[0].transaction.actions[0].functionCall.methodName,'near_deposit'); assert.equal(h.queries[0].network,'testnet');
  assert.deepEqual(await createOathWallet(h.deps).getAccounts({network:'testnet'}),[account]);
  await h.wallet.signOut({network:'testnet'}); assert.equal(h.stored.size,0);
});
test('batch preserves order and precise nonces beyond Number safe range', async () => {
  const h=harness(); await h.wallet.signIn({network:'testnet'});
  await h.wallet.signAndSendTransactions({network:'testnet',transactions:[call,call,call]});
  assert.deepEqual(h.sent.map(x=>x.transaction.nonce.toString()),['9007199254740991','9007199254740992','9007199254740993']);
  assert.equal(h.requests.filter(x=>x.request.method==='near_signTransactions').length,1);
});
test('wrong network, signer and unsupported sign-in permissions fail closed', async () => {
  const h=harness(); await h.wallet.signIn({network:'testnet'});
  await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'devnet'}),/network/);
  await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'mainnet'}),/Connect/);
  await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'testnet',signerId:'other.testnet'}),/signer/);
  await assert.rejects(h.wallet.signIn({network:'testnet',addFunctionCallKey:{}}),/function-call key/); assert.equal(h.sent.length,0);
});
test('malformed, incomplete, mutated and invalid signatures cannot be broadcast',async()=>{
  for(const result of [{type:'Buffer',data:[-1]}, {type:'Buffer',data:[1,2,3]}, []]) {
    const h=harness(); await h.wallet.signIn({network:'testnet'}); h.state.result=result;
    await assert.rejects(h.wallet.signAndSendTransactions({network:'testnet',transactions:[call]})); assert.equal(h.sent.length,0);
  }
  for(const mutate of [bytes=>{bytes[5]^=1},bytes=>{bytes[bytes.length-1]^=1}]) {
    const h=harness();await h.wallet.signIn({network:'testnet'}); const original=h.deps.bridge.request;
    h.deps.bridge.request=async p=>{const r=await original(p);if(p.request.method==='near_signTransaction')mutate(r.data);return r};
    await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'testnet'}));assert.equal(h.sent.length,0);
  }
});
test('unsafe RPC nonce, excessive batch and unsupported actions are rejected',async()=>{
  const h=harness();await h.wallet.signIn({network:'testnet'}); h.state.nonce=Number.MAX_SAFE_INTEGER+1;
  await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'testnet'}),/nonce/);
  await assert.rejects(h.wallet.signAndSendTransactions({network:'testnet',transactions:Array(17).fill(call)}),/1–16/); h.state.nonce=1;
  await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'testnet',actions:[{type:'DeployGlobalContract'}]}),/action/); assert.equal(h.sent.length,0);
});
test('on-chain failure stops dependent batch without retry',async()=>{
  const h=harness();await h.wallet.signIn({network:'testnet'});h.state.outcome={status:{Failure:{}}};
  await assert.rejects(h.wallet.signAndSendTransactions({network:'testnet',transactions:[call,call]}),/did not succeed/);assert.equal(h.sent.length,1);
});
test('concurrent signing request is rejected',async()=>{
  const h=harness();await h.wallet.signIn({network:'testnet'});const first=h.wallet.signAndSendTransaction({...call,network:'testnet'});
  await assert.rejects(h.wallet.signAndSendTransaction({...call,network:'testnet'}),/pending/);await first;
});
test('pairing correlates URI, requests implemented methods and cleans up',async()=>{
  const h=harness();let closed=0,unsubscribed=0;
  const session=await pairOath({connect:async p=>{assert.deepEqual(p.requiredNamespaces.near.methods,OATH_METHODS);assert.deepEqual(p.requiredNamespaces.near.events,[]);return {uri:'wc:pairing@2?relay-protocol=irn'}},getSession:async p=>{assert.equal(p.pairingTopic,'pairing');return h.state.session}},
    {open:async()=>{},onClose:()=>()=>{unsubscribed++},close:()=>{closed++}},'testnet',100,1);
  assert.equal(session.topic,'oath-session');assert.equal(closed,1);assert.equal(unsubscribed,1);
});
test('pairing cancellation and timeout settle and stop polling',async()=>{
  for(const cancel of [true,false]) {
    let reads=0,closed=0;
    await assert.rejects(pairOath({connect:async()=>({uri:'wc:pairing@2?relay-protocol=irn'}),getSession:async()=>{reads++;return null}},
      {open:async()=>{},onClose:cb=>{if(cancel)cb();return()=>{}},close:()=>{closed++}},'testnet',5,1),cancel?/cancelled/:/expired/);
    const previous=reads;await new Promise(r=>setTimeout(r,10));assert.equal(reads,previous);assert.equal(closed,1);
  }
});
test('pairing never accepts another pairing topic with compatible accounts',async()=>{
  const h=harness();h.state.session.pairingTopic='another-pairing';
  await assert.rejects(pairOath({connect:async()=>({uri:'wc:pairing@2?relay-protocol=irn'}),getSession:async()=>h.state.session},
    {open:async()=>{},onClose:()=>()=>{},close:()=>{}},'testnet',5,1),/expired/);
});
