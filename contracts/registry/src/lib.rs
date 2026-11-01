//! NEAR Connect registry.
//!
//! Holds the wallet manifest and the executor bundles that `@hot-labs/near-connect`
//! loads via `"executor": "onchain:<this contract>"`.
//!
//! - Chunks are content-addressed: anyone can upload one (paying for its storage), the key is
//!   `sha256(chunk)`, so an upload cannot overwrite or forge anything.
//! - Only the owner (a Sputnik DAO) publishes: `publish` points a wallet id at a list of chunk
//!   hashes plus the sha256 of the decoded code. Proposals stay small and human-readable.
//! - The client reads everything through view calls (`call_function`), not `view_state`:
//!   RPC nodes refuse `view_state` once the account's state exceeds 50 KB.
//!
//! Manifest signing: `set_manifest` bumps `sequence` and asks the NEAR MPC network to sign
//! `MANIFEST_SIGNING_PREFIX || sequence (u64 BE) || sha256(manifest)` with an ed25519 key derived for
//! this contract. The payload is built here from on-chain state, so the DAO never signs blind bytes.
//! Clients pin the derived public key and accept a manifest from any transport (RPC, CDN, own domain)
//! only if the signature verifies and `sequence` does not go back.
//!
//! The contract has no upgrade method on purpose. Upgrades go through a full access key on the
//! registry account, e.g. an MPC key derived for the DAO (chain signatures).

use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::serde_json::{self, json};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, CurveType, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey};

pub type Hash = [u8; 32];

/// Hard cap per chunk. A transaction is limited to ~1.5 MB anyway; keeping chunks smaller
/// keeps every view call well inside the 4 MB return-data limit and the view gas limit.
pub const MAX_CHUNK_SIZE: usize = 1_000_000;
pub const MAX_MANIFEST_SIZE: usize = 256 * 1024;

/// Domain separation for manifest signatures. Bump the version if the message layout changes.
pub const MANIFEST_SIGNING_PREFIX: &[u8] = b"near-connect:manifest:v1:";
/// The MPC contract requires at least 15 Tgas on `sign` and 1 yoctoNEAR deposit.
const GAS_FOR_SIGN: Gas = Gas::from_tgas(30);
const GAS_FOR_ON_SIGNED: Gas = Gas::from_tgas(15);
const SIGN_DEPOSIT: NearToken = NearToken::from_yoctonear(1);

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Bundles,
    Chunks,
    ChunkMeta,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Bundle {
    /// Informational, mirrors the wallet version in the manifest.
    pub version: String,
    /// Hex sha256 of the decoded executor code (after `encoding` is undone).
    pub sha256: String,
    /// `identity` or `gzip`.
    pub encoding: String,
    /// Total size of the encoded bundle in bytes (sum of chunks).
    pub size: u64,
    /// Hex sha256 of each chunk, in order.
    pub chunks: Vec<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct ChunkMeta {
    pub uploader: AccountId,
    pub deposit: NearToken,
    pub size: u64,
    /// How many published bundles reference this chunk. Referenced chunks cannot be deleted.
    pub refs: u32,
}

/// Where and how the manifest is signed. `public_key` is the key the MPC contract derives for
/// (this contract, `path`, `domain_id`): `v1.signer.derived_public_key({ path, predecessor, domain_id })`.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct MpcConfig {
    pub contract_id: AccountId,
    pub path: String,
    /// Ed25519 (Frost) domain; 1 on mainnet `v1.signer`.
    pub domain_id: u32,
    pub public_key: PublicKey,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct ManifestSignature {
    pub sequence: u64,
    /// Hex sha256 of the manifest bytes.
    pub sha256: String,
    /// Hex ed25519 signature over `MANIFEST_SIGNING_PREFIX || sequence (u64 BE) || sha256`.
    pub signature: String,
    pub public_key: PublicKey,
}

/// What clients consume: the manifest string and its signature, as one envelope.
#[near(serializers = [json])]
pub struct SignedManifest {
    pub manifest: String,
    pub signature: Option<ManifestSignature>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    owner_id: AccountId,
    manifest: String,
    manifest_sequence: u64,
    manifest_signature: Option<ManifestSignature>,
    mpc: Option<MpcConfig>,
    bundles: IterableMap<String, Bundle>,
    chunks: LookupMap<Hash, Vec<u8>>,
    chunk_meta: LookupMap<Hash, ChunkMeta>,
}

#[near]
impl Registry {
    #[init]
    pub fn new(owner_id: AccountId, mpc: Option<MpcConfig>) -> Self {
        if let Some(mpc) = &mpc {
            assert_ed25519(&mpc.public_key);
        }
        Self {
            owner_id,
            manifest: String::new(),
            manifest_sequence: 0,
            manifest_signature: None,
            mpc,
            bundles: IterableMap::new(StorageKey::Bundles),
            chunks: LookupMap::new(StorageKey::Chunks),
            chunk_meta: LookupMap::new(StorageKey::ChunkMeta),
        }
    }

    // ---------------------------------------------------------------- uploads (permissionless)

    /// Uploads one chunk. The arguments are the raw chunk bytes (no JSON), e.g.
    /// `near contract call-function as-transaction <registry> upload_chunk file-args chunk.bin ...`.
    /// Attach enough deposit for storage; the surplus is refunded. Returns the chunk hash (hex).
    /// Re-uploading an existing chunk is a no-op that refunds the whole deposit.
    #[payable]
    pub fn upload_chunk(&mut self) -> String {
        let data = env::input().unwrap_or_default();
        require!(!data.is_empty(), "Empty chunk");
        require!(data.len() <= MAX_CHUNK_SIZE, "Chunk is too large");

        let hash = env::sha256_array(&data);
        let deposit = env::attached_deposit();
        let caller = env::predecessor_account_id();

        if self.chunks.contains_key(&hash) {
            refund(&caller, deposit);
            return to_hex(&hash);
        }

        let before = env::storage_usage();
        let size = data.len() as u64;
        self.chunks.insert(hash, data);
        self.chunk_meta.insert(hash, ChunkMeta { uploader: caller.clone(), deposit: NearToken::from_yoctonear(0), size, refs: 0 });
        self.chunks.flush();
        self.chunk_meta.flush();

        let cost = storage_cost(before);
        require!(deposit >= cost, format!("Attach at least {} yoctoNEAR for storage", cost.as_yoctonear()));
        self.chunk_meta.get_mut(&hash).unwrap().deposit = cost;
        refund(&caller, deposit.saturating_sub(cost));

        to_hex(&hash)
    }

    /// Deletes an unreferenced chunk and returns its storage deposit to the uploader.
    /// Callable by the uploader or the owner.
    pub fn delete_chunk(&mut self, hash: String) {
        let hash = parse_hash(&hash);
        let meta = self.chunk_meta.get(&hash).cloned().unwrap_or_else(|| env::panic_str("Unknown chunk"));
        let caller = env::predecessor_account_id();
        require!(caller == meta.uploader || caller == self.owner_id, "Only the uploader or the owner");
        require!(meta.refs == 0, "Chunk is used by a published bundle");

        self.chunks.remove(&hash);
        self.chunk_meta.remove(&hash);
        refund(&meta.uploader, meta.deposit);
    }

    // ---------------------------------------------------------------- owner (DAO)

    /// Points `wallet_id` at a bundle made of already uploaded chunks.
    /// Attach deposit for the bundle record storage; the surplus is refunded.
    #[payable]
    pub fn publish(&mut self, wallet_id: String, bundle: Bundle) {
        self.assert_owner();
        require!(!wallet_id.is_empty() && wallet_id.len() <= 64, "Invalid wallet id");
        require!(bundle.encoding == "identity" || bundle.encoding == "gzip", "Encoding must be identity or gzip");
        require!(!bundle.chunks.is_empty(), "Bundle has no chunks");
        parse_hash(&bundle.sha256);

        let mut size = 0u64;
        for chunk in bundle.chunks.iter() {
            let meta = self.chunk_meta.get(&parse_hash(chunk)).unwrap_or_else(|| env::panic_str(&format!("Chunk {chunk} is not uploaded")));
            size += meta.size;
        }
        require!(size == bundle.size, "Bundle size does not match the chunks");

        let before = env::storage_usage();
        let normalized = Bundle { sha256: bundle.sha256.to_lowercase(), chunks: bundle.chunks.iter().map(|c| c.to_lowercase()).collect(), ..bundle };
        self.change_refs(&normalized.chunks, true);
        if let Some(old) = self.bundles.insert(wallet_id, normalized) {
            self.change_refs(&old.chunks, false);
        }
        self.settle_owner_storage(before);
    }

    pub fn unpublish(&mut self, wallet_id: String) {
        self.assert_owner();
        let old = self.bundles.remove(&wallet_id).unwrap_or_else(|| env::panic_str("Unknown wallet id"));
        self.change_refs(&old.chunks, false);
    }

    /// Stores the wallet manifest (the same JSON as `repository/manifest.json`), bumps `sequence`
    /// and, when MPC is configured, requests its signature. Attach storage deposit + 1 yoctoNEAR
    /// and ~100 Tgas; the signature lands in `on_manifest_signed` a few blocks later.
    #[payable]
    pub fn set_manifest(&mut self, manifest: String) -> Option<Promise> {
        self.assert_owner();
        require!(manifest.len() <= MAX_MANIFEST_SIZE, "Manifest is too large");
        require!(serde_json::from_str::<serde_json::Value>(&manifest).is_ok(), "Manifest must be valid JSON");

        let before = env::storage_usage();
        self.manifest = manifest;
        self.manifest_sequence += 1;
        self.manifest_signature = None;

        let reserve = if self.mpc.is_some() { SIGN_DEPOSIT } else { NearToken::from_yoctonear(0) };
        self.settle_storage(before, reserve);
        self.mpc.as_ref().map(|_| self.sign_current_manifest())
    }

    /// Re-requests the signature of the current manifest, e.g. after an MPC timeout.
    /// Open to anyone: it can only sign what is already on-chain. Attach 1 yoctoNEAR.
    #[payable]
    pub fn request_manifest_signature(&mut self) -> Promise {
        require!(env::attached_deposit() >= SIGN_DEPOSIT, "Attach 1 yoctoNEAR for the MPC request");
        require!(self.manifest_sequence > 0, "No manifest");
        require!(self.manifest_signature.is_none(), "Manifest is already signed");
        self.sign_current_manifest()
    }

    #[private]
    pub fn on_manifest_signed(&mut self, sequence: u64, sha256: String, #[callback_result] response: Result<serde_json::Value, PromiseError>) -> bool {
        if sequence != self.manifest_sequence {
            env::log_str(&format!("Stale signature for sequence {sequence}, current is {}", self.manifest_sequence));
            return false;
        }

        let Ok(response) = response else {
            env::log_str("MPC sign failed, call request_manifest_signature to retry");
            return false;
        };

        let mpc = self.mpc.clone().unwrap_or_else(|| env::panic_str("MPC is not configured"));
        let signature = parse_ed25519_response(&response);
        let message = manifest_message(sequence, &parse_hash(&sha256));
        let key: [u8; 32] = mpc.public_key.as_bytes()[1..].try_into().unwrap();
        require!(env::ed25519_verify(&signature, &message, &key), "MPC signature does not verify against the configured public key");

        self.manifest_signature = Some(ManifestSignature { sequence, sha256, signature: to_hex(&signature), public_key: mpc.public_key });
        true
    }

    /// Owner only. Changing the key breaks clients that pinned the old one, plan a rotation.
    pub fn set_mpc_config(&mut self, mpc: Option<MpcConfig>) {
        self.assert_owner();
        if let Some(mpc) = &mpc {
            assert_ed25519(&mpc.public_key);
        }
        self.mpc = mpc;
        self.manifest_signature = None;
    }

    pub fn set_owner(&mut self, owner_id: AccountId) {
        self.assert_owner();
        self.owner_id = owner_id;
    }

    // ---------------------------------------------------------------- views

    /// Returns the raw manifest JSON (not wrapped in a JSON string).
    pub fn get_manifest(&self) {
        env::value_return(self.manifest.as_bytes());
    }

    /// Returns the raw chunk bytes.
    pub fn get_chunk(&self, hash: String) {
        let data = self.chunks.get(&parse_hash(&hash)).unwrap_or_else(|| env::panic_str("Unknown chunk"));
        env::value_return(data);
    }

    /// Manifest plus signature in one envelope; the same JSON can be mirrored to a CDN as is.
    pub fn get_signed_manifest(&self) -> SignedManifest {
        SignedManifest { manifest: self.manifest.clone(), signature: self.manifest_signature.clone() }
    }

    pub fn get_manifest_sequence(&self) -> u64 {
        self.manifest_sequence
    }

    pub fn get_mpc_config(&self) -> Option<MpcConfig> {
        self.mpc.clone()
    }

    pub fn get_bundle(&self, wallet_id: String) -> Option<Bundle> {
        self.bundles.get(&wallet_id).cloned()
    }

    pub fn get_bundles(&self) -> Vec<(String, Bundle)> {
        self.bundles.iter().map(|(id, b)| (id.clone(), b.clone())).collect()
    }

    pub fn get_chunk_meta(&self, hash: String) -> Option<ChunkMeta> {
        self.chunk_meta.get(&parse_hash(&hash)).cloned()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }
}

impl Registry {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the owner");
    }

    fn change_refs(&mut self, chunks: &[String], increment: bool) {
        for chunk in chunks {
            let meta = self.chunk_meta.get_mut(&parse_hash(chunk)).unwrap_or_else(|| env::panic_str("Unknown chunk"));
            meta.refs = if increment { meta.refs + 1 } else { meta.refs.saturating_sub(1) };
        }
    }

    fn settle_owner_storage(&mut self, before: u64) {
        self.settle_storage(before, NearToken::from_yoctonear(0));
    }

    /// Charges the caller for state growth since `before` from the attached deposit, keeps `reserve`
    /// for an outgoing call, refunds the rest. Freed state is not refunded: it stays on the registry.
    fn settle_storage(&mut self, before: u64, reserve: NearToken) {
        self.bundles.flush();
        self.chunk_meta.flush();
        let deposit = env::attached_deposit();
        let cost = storage_cost(before).saturating_add(reserve);
        require!(deposit >= cost, format!("Attach at least {} yoctoNEAR (storage + MPC deposit)", cost.as_yoctonear()));
        refund(&env::predecessor_account_id(), deposit.saturating_sub(cost));
    }

    fn sign_current_manifest(&self) -> Promise {
        let mpc = self.mpc.clone().unwrap_or_else(|| env::panic_str("MPC is not configured"));
        let sha256 = env::sha256_array(self.manifest.as_bytes());
        let message = manifest_message(self.manifest_sequence, &sha256);
        let args = json!({ "request": { "path": mpc.path, "payload_v2": { "Eddsa": to_hex(&message) }, "domain_id": mpc.domain_id } });

        Promise::new(mpc.contract_id)
            .function_call("sign".to_string(), args.to_string().into_bytes(), SIGN_DEPOSIT, GAS_FOR_SIGN)
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_ON_SIGNED).on_manifest_signed(self.manifest_sequence, to_hex(&sha256)))
    }
}

/// `MANIFEST_SIGNING_PREFIX || sequence (u64 big-endian) || sha256(manifest)`
pub fn manifest_message(sequence: u64, sha256: &Hash) -> Vec<u8> {
    [MANIFEST_SIGNING_PREFIX, &sequence.to_be_bytes(), sha256].concat()
}

/// MPC returns `{ "scheme": "Ed25519", "signature": [64 bytes] }`.
fn parse_ed25519_response(response: &serde_json::Value) -> [u8; 64] {
    require!(response["scheme"] == "Ed25519", "Expected an Ed25519 signature from MPC");
    let bytes: Vec<u8> = serde_json::from_value(response["signature"].clone()).unwrap_or_else(|_| env::panic_str("Malformed MPC signature"));
    bytes.try_into().unwrap_or_else(|_| env::panic_str("Ed25519 signature must be 64 bytes"))
}

fn assert_ed25519(key: &PublicKey) {
    require!(key.curve_type() == CurveType::ED25519, "MPC public key must be ed25519");
}

fn storage_cost(before: u64) -> NearToken {
    let grown = env::storage_usage().saturating_sub(before);
    env::storage_byte_cost().saturating_mul(grown as u128)
}

fn refund(to: &AccountId, amount: NearToken) {
    if !amount.is_zero() {
        Promise::new(to.clone()).transfer(amount).detach();
    }
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    bytes.iter().flat_map(|b| [HEX[(b >> 4) as usize] as char, HEX[(b & 0xf) as usize] as char]).collect()
}

fn parse_hash(hex: &str) -> Hash {
    let hex = hex.as_bytes();
    require!(hex.len() == 64, "Hash must be 64 hex chars");
    let nibble = |c: u8| match c {
        b'0'..=b'9' => c - b'0',
        b'a'..=b'f' => c - b'a' + 10,
        b'A'..=b'F' => c - b'A' + 10,
        _ => env::panic_str("Invalid hex"),
    };
    let mut out = [0u8; 32];
    for (i, byte) in out.iter_mut().enumerate() {
        *byte = (nibble(hex[i * 2]) << 4) | nibble(hex[i * 2 + 1]);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn dao() -> AccountId {
        "devhub.sputnik-dao.near".parse().unwrap()
    }
    fn alice() -> AccountId {
        "alice.near".parse().unwrap()
    }

    fn ctx(caller: AccountId, deposit: NearToken, input: Vec<u8>) {
        let mut context = VMContextBuilder::new().predecessor_account_id(caller).attached_deposit(deposit).build();
        context.input = input.into();
        testing_env!(context);
    }

    fn upload(r: &mut Registry, data: &[u8]) -> String {
        ctx(alice(), NearToken::from_near(10), data.to_vec());
        r.upload_chunk()
    }

    fn bundle(chunks: Vec<String>, size: u64) -> Bundle {
        Bundle { version: "1.0.0".into(), sha256: "a".repeat(64), encoding: "gzip".into(), size, chunks }
    }

    #[test]
    fn upload_is_content_addressed() {
        ctx(dao(), NearToken::from_yoctonear(0), vec![]);
        let mut r = Registry::new(dao(), None);
        let h = upload(&mut r, b"hello");
        assert_eq!(h, to_hex(&env::sha256_array(b"hello")));
        assert_eq!(upload(&mut r, b"hello"), h);
        assert_eq!(r.get_chunk_meta(h).unwrap().size, 5);
    }

    #[test]
    fn publish_counts_refs_and_blocks_delete() {
        ctx(dao(), NearToken::from_yoctonear(0), vec![]);
        let mut r = Registry::new(dao(), None);
        let a = upload(&mut r, b"aaa");
        let b = upload(&mut r, b"bb");

        ctx(dao(), NearToken::from_near(1), vec![]);
        r.publish("hot-wallet".into(), bundle(vec![a.clone(), b.clone()], 5));
        assert_eq!(r.get_chunk_meta(a.clone()).unwrap().refs, 1);
        assert_eq!(r.get_bundle("hot-wallet".into()).unwrap().chunks.len(), 2);

        // Republishing with only `b` drops the ref on `a`
        ctx(dao(), NearToken::from_near(1), vec![]);
        r.publish("hot-wallet".into(), bundle(vec![b.clone()], 2));
        assert_eq!(r.get_chunk_meta(a.clone()).unwrap().refs, 0);
        assert_eq!(r.get_chunk_meta(b.clone()).unwrap().refs, 1);

        ctx(alice(), NearToken::from_yoctonear(0), vec![]);
        r.delete_chunk(a.clone());
        assert!(r.get_chunk_meta(a).is_none());
    }

    #[test]
    #[should_panic(expected = "Chunk is used by a published bundle")]
    fn referenced_chunk_cannot_be_deleted() {
        ctx(dao(), NearToken::from_yoctonear(0), vec![]);
        let mut r = Registry::new(dao(), None);
        let a = upload(&mut r, b"aaa");
        ctx(dao(), NearToken::from_near(1), vec![]);
        r.publish("w".into(), bundle(vec![a.clone()], 3));
        ctx(alice(), NearToken::from_yoctonear(0), vec![]);
        r.delete_chunk(a);
    }

    #[test]
    #[should_panic(expected = "Only the owner")]
    fn only_owner_publishes() {
        ctx(dao(), NearToken::from_yoctonear(0), vec![]);
        let mut r = Registry::new(dao(), None);
        let a = upload(&mut r, b"aaa");
        ctx(alice(), NearToken::from_near(1), vec![]);
        r.publish("w".into(), bundle(vec![a], 3));
    }

    #[test]
    #[should_panic(expected = "Bundle size does not match the chunks")]
    fn size_must_match() {
        ctx(dao(), NearToken::from_yoctonear(0), vec![]);
        let mut r = Registry::new(dao(), None);
        let a = upload(&mut r, b"aaa");
        ctx(dao(), NearToken::from_near(1), vec![]);
        r.publish("w".into(), bundle(vec![a], 4));
    }

    use ed25519_dalek::{Signer, SigningKey};

    fn mpc_key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    fn mpc_config() -> MpcConfig {
        let mut key = vec![0u8]; // ed25519 curve tag
        key.extend_from_slice(mpc_key().verifying_key().as_bytes());
        MpcConfig { contract_id: "v1.signer".parse().unwrap(), path: "near-connect/manifest".into(), domain_id: 1, public_key: PublicKey::try_from(key).unwrap() }
    }

    fn registry() -> AccountId {
        "registry.near".parse().unwrap()
    }

    /// Simulates the MPC callback with `response` as the `sign` result (None = failed promise).
    fn callback(r: &mut Registry, sequence: u64, sha256: String, response: Option<serde_json::Value>) -> bool {
        let context = VMContextBuilder::new().current_account_id(registry()).predecessor_account_id(registry()).build();
        testing_env!(context);
        r.on_manifest_signed(sequence, sha256, match response {
            Some(v) => Ok(v),
            None => Err(PromiseError::Failed),
        })
    }

    fn signed_registry() -> (Registry, String) {
        ctx(dao(), NearToken::from_yoctonear(0), vec![]);
        let mut r = Registry::new(dao(), Some(mpc_config()));
        ctx(dao(), NearToken::from_near(1), vec![]);
        assert!(r.set_manifest("{\"wallets\":[]}".into()).is_some());
        let sha = to_hex(&env::sha256_array(b"{\"wallets\":[]}"));
        (r, sha)
    }

    #[test]
    fn sends_v1_signer_sign_request() {
        let (_, sha) = signed_registry();
        let receipts = near_sdk::test_utils::get_created_receipts();
        let sign = receipts.iter().find(|r| r.receiver_id.as_str() == "v1.signer").expect("no MPC receipt");
        let near_sdk::mock::MockAction::FunctionCallWeight { method_name, args, attached_deposit, prepaid_gas, .. } = &sign.actions[0] else {
            panic!("expected a function call");
        };
        assert_eq!(method_name, b"sign");
        assert_eq!(*attached_deposit, SIGN_DEPOSIT);
        assert!(prepaid_gas.as_tgas() >= 15);

        let args: serde_json::Value = serde_json::from_slice(args).unwrap();
        let expected = to_hex(&manifest_message(1, &parse_hash(&sha)));
        assert_eq!(args, json!({ "request": { "path": "near-connect/manifest", "payload_v2": { "Eddsa": expected }, "domain_id": 1 } }));
    }

    #[test]
    fn message_layout_is_stable() {
        let msg = manifest_message(1, &[0xab; 32]);
        assert_eq!(&msg[..MANIFEST_SIGNING_PREFIX.len()], b"near-connect:manifest:v1:");
        assert_eq!(&msg[MANIFEST_SIGNING_PREFIX.len()..MANIFEST_SIGNING_PREFIX.len() + 8], &[0, 0, 0, 0, 0, 0, 0, 1]);
        assert_eq!(msg.len(), MANIFEST_SIGNING_PREFIX.len() + 8 + 32);
    }

    #[test]
    fn stores_a_valid_mpc_signature() {
        let (mut r, sha) = signed_registry();
        assert_eq!(r.get_manifest_sequence(), 1);
        let sig = mpc_key().sign(&manifest_message(1, &parse_hash(&sha)));
        let response = json!({ "scheme": "Ed25519", "signature": sig.to_bytes().to_vec() });
        assert!(callback(&mut r, 1, sha.clone(), Some(response)));
        let signed = r.get_signed_manifest().signature.unwrap();
        assert_eq!(signed.sequence, 1);
        assert_eq!(signed.sha256, sha);
        assert_eq!(signed.signature, to_hex(&sig.to_bytes()));
    }

    #[test]
    #[should_panic(expected = "MPC signature does not verify")]
    fn rejects_a_signature_from_another_key() {
        let (mut r, sha) = signed_registry();
        let sig = SigningKey::from_bytes(&[9u8; 32]).sign(&manifest_message(1, &parse_hash(&sha)));
        callback(&mut r, 1, sha, Some(json!({ "scheme": "Ed25519", "signature": sig.to_bytes().to_vec() })));
    }

    #[test]
    fn ignores_stale_and_failed_signatures() {
        let (mut r, sha) = signed_registry();
        let sig = mpc_key().sign(&manifest_message(1, &parse_hash(&sha)));
        assert!(!callback(&mut r, 1, sha.clone(), None));
        assert!(r.get_signed_manifest().signature.is_none());

        ctx(dao(), NearToken::from_near(1), vec![]);
        r.set_manifest("{\"wallets\":[1]}".into());
        assert!(!callback(&mut r, 1, sha, Some(json!({ "scheme": "Ed25519", "signature": sig.to_bytes().to_vec() }))));
        assert!(r.get_signed_manifest().signature.is_none());
    }

    #[test]
    fn manifest_must_be_json() {
        ctx(dao(), NearToken::from_near(1), vec![]);
        let mut r = Registry::new(dao(), None);
        r.set_manifest("{\"wallets\":[]}".into());
    }
}

#[cfg(test)]
mod vector {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    /// Prints a cross-language test vector: `cargo test vector -- --nocapture`
    #[test]
    fn print_vector() {
        let manifest = br#"{"wallets":[]}"#;
        let msg = manifest_message(42, &env::sha256_array(manifest));
        let key = SigningKey::from_bytes(&[7u8; 32]);
        println!("VECTOR {} {} {}", to_hex(&msg), to_hex(key.verifying_key().as_bytes()), to_hex(&key.sign(&msg).to_bytes()));
    }
}
