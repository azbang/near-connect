//! NEAR Connect registry.
//!
//! Holds the wallet manifest (signed by NEAR MPC) and the executor bundles that `@hot-labs/near-connect`
//! loads via `"executor": "onchain:<this contract>:get_code"`.
//!
//! - **One source of truth.** The manifest is the release: each wallet entry carries `sha256` of its code.
//!   `set_manifest` (owner = DAO) indexes `wallet_id -> sha256`, requires every bundle the manifest serves
//!   from this contract to be uploaded, deletes bundles the previous manifest used and the new one does
//!   not, bumps `sequence` and asks MPC to sign. One proposal, one action, atomic.
//! - **Bundles in one transaction.** `upload_bundle` takes `sha256(code) || bytes` as raw args, gzip or
//!   plain. Only allow-listed uploaders (a CI bot on a function-call key) may upload. The contract cannot
//!   un-gzip, so it does not check the claimed hash: clients do, against the signed manifest, and a bad
//!   upload only makes that source fail.
//! - **The registry pays for storage** from its own balance (funded once by the DAO), so the bot needs
//!   no NEAR beyond gas. `max_pending_bytes` bounds what uploads that were never published can lock;
//!   they can be pruned by anyone after `pending_ttl`.
//! - **Reads are view calls** (`call_function`), not `view_state`: RPC nodes refuse `view_state` once
//!   the account's state exceeds 50 KB.
//!
//! Manifest signature: MPC signs `MANIFEST_SIGNING_PREFIX || sequence (u64 BE) || sha256(manifest)` with an
//! ed25519 key derived for this contract. The payload is built here from on-chain state, so the DAO never
//! signs blind bytes. Clients pin the derived public key and accept a manifest from any transport only if
//! the signature verifies and `sequence` does not go back.
//!
//! No upgrade method on purpose: upgrades go through a full access key, e.g. an MPC key derived for the DAO.

use near_sdk::serde_json::{self, json, Value};
use near_sdk::store::{IterableMap, IterableSet, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, CurveType, Gas, NearToken, PanicOnDefault, Promise, PromiseError, PublicKey};
use std::collections::BTreeMap;

pub type Hash = [u8; 32];

/// A transaction is capped at 1.5 MiB; the bundle must fit in one upload with room for the tx envelope.
pub const MAX_BUNDLE_SIZE: usize = 1_500_000;
pub const MAX_MANIFEST_SIZE: usize = 256 * 1024;
const DEFAULT_MAX_PENDING_BYTES: u64 = 5_000_000;
const DEFAULT_PENDING_TTL_NS: u64 = 14 * 24 * 3600 * 1_000_000_000;

/// Domain separation for manifest signatures. Bump the version if the message layout changes.
pub const MANIFEST_SIGNING_PREFIX: &[u8] = b"near-connect:manifest:v1:";
/// The MPC contract requires at least 15 Tgas on `sign` and a 1 yoctoNEAR deposit (paid by the registry).
const GAS_FOR_SIGN: Gas = Gas::from_tgas(30);
const GAS_FOR_ON_SIGNED: Gas = Gas::from_tgas(15);
const SIGN_DEPOSIT: NearToken = NearToken::from_yoctonear(1);

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Uploaders,
    Wallets,
    Bundles,
    BundleData,
}

/// Where and how the manifest is signed. `public_key` is the key the MPC contract derives for
/// (this contract, `path`, `domain_id`): `v1.signer.derived_public_key({ path, predecessor, domain_id })`.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct MpcConfig {
    pub contract_id: AccountId,
    pub path: String,
    /// Ed25519 (Frost) domain; 1 on `v1.signer` and `v1.signer-prod.testnet`.
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

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct BundleInfo {
    pub uploader: AccountId,
    /// Block timestamp of the upload, nanoseconds.
    pub uploaded_at: u64,
    pub size: u64,
    /// Number of wallets in the current manifest that use this bundle. 0 = pending (never published or
    /// published earlier and replaced, in which case it is already deleted).
    pub refs: u32,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Limits {
    pub max_pending_bytes: u64,
    pub pending_ttl_ns: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    owner_id: AccountId,
    uploaders: IterableSet<AccountId>,
    limits: Limits,
    pending_bytes: u64,

    manifest: String,
    manifest_sequence: u64,
    manifest_signature: Option<ManifestSignature>,
    mpc: Option<MpcConfig>,

    /// `wallet_id -> sha256(code)` for the wallets of the current manifest that are served from here.
    wallets: IterableMap<String, Hash>,
    bundles: IterableMap<Hash, BundleInfo>,
    bundle_data: LookupMap<Hash, Vec<u8>>,
}

#[near]
impl Registry {
    #[init]
    pub fn new(owner_id: AccountId, mpc: Option<MpcConfig>, uploaders: Vec<AccountId>) -> Self {
        if let Some(mpc) = &mpc {
            assert_ed25519(&mpc.public_key);
        }
        let mut set = IterableSet::new(StorageKey::Uploaders);
        set.extend(uploaders);
        Self {
            owner_id,
            uploaders: set,
            limits: Limits { max_pending_bytes: DEFAULT_MAX_PENDING_BYTES, pending_ttl_ns: DEFAULT_PENDING_TTL_NS },
            pending_bytes: 0,
            manifest: String::new(),
            manifest_sequence: 0,
            manifest_signature: None,
            mpc,
            wallets: IterableMap::new(StorageKey::Wallets),
            bundles: IterableMap::new(StorageKey::Bundles),
            bundle_data: LookupMap::new(StorageKey::BundleData),
        }
    }

    // ---------------------------------------------------------------- uploads (allow-listed bot)

    /// Raw args: `sha256(code)` (32 bytes) followed by the bundle bytes (gzip or plain). Not payable, so a
    /// function-call key works; storage comes from the registry balance. Re-uploading a known hash is a no-op.
    /// Returns the hex hash.
    pub fn upload_bundle(&mut self) -> String {
        require!(self.uploaders.contains(&env::predecessor_account_id()), "Not an uploader");
        let input = env::input().unwrap_or_default();
        require!(input.len() > 32, "Expected sha256(code) followed by the bundle bytes");
        require!(input.len() - 32 <= MAX_BUNDLE_SIZE, "Bundle is too large");

        let hash: Hash = input[..32].try_into().unwrap();
        if self.bundles.contains_key(&hash) {
            return to_hex(&hash);
        }

        let size = (input.len() - 32) as u64;
        require!(self.pending_bytes + size <= self.limits.max_pending_bytes, "Pending uploads limit reached: publish or prune first");
        self.pending_bytes += size;
        self.bundle_data.insert(hash, input[32..].to_vec());
        self.bundles.insert(hash, BundleInfo { uploader: env::predecessor_account_id(), uploaded_at: env::block_timestamp(), size, refs: 0 });
        to_hex(&hash)
    }

    /// Deletes a bundle no wallet uses. Anyone after `pending_ttl`, the uploader or the owner at any time.
    pub fn prune(&mut self, sha256: String) {
        let hash = parse_hash(&sha256);
        let info = self.bundles.get(&hash).cloned().unwrap_or_else(|| env::panic_str("Unknown bundle"));
        require!(info.refs == 0, "Bundle is used by the current manifest");
        let caller = env::predecessor_account_id();
        let expired = env::block_timestamp().saturating_sub(info.uploaded_at) >= self.limits.pending_ttl_ns;
        require!(expired || caller == info.uploader || caller == self.owner_id, "Bundle is not expired yet");
        self.delete_bundle(&hash, true);
    }

    // ---------------------------------------------------------------- owner (DAO)

    /// The release. Stores the manifest (same JSON as `repository/manifest.json`), indexes the wallets whose
    /// `executor` points at this contract, requires their bundles (by `sha256`) to be uploaded, deletes the
    /// bundles the previous manifest used and this one does not, bumps `sequence` and requests the MPC signature.
    /// Attach ~200 Tgas; nothing needs to be deposited.
    pub fn set_manifest(&mut self, manifest: String) -> Option<Promise> {
        self.assert_owner();
        require!(manifest.len() <= MAX_MANIFEST_SIZE, "Manifest is too large");
        let parsed: Value = serde_json::from_str(&manifest).unwrap_or_else(|_| env::panic_str("Manifest must be valid JSON"));
        let next = self.served_wallets(&parsed);

        for (wallet_id, hash) in next.iter() {
            require!(self.bundles.contains_key(hash), format!("Bundle {} for {wallet_id} is not uploaded", to_hex(hash)));
        }

        // Swap the index and the reference counts; bundles that drop to zero refs were released before and go away
        let previous: Vec<Hash> = self.wallets.values().copied().collect();
        self.wallets.clear();
        for (wallet_id, hash) in next {
            self.add_ref(&hash);
            self.wallets.insert(wallet_id, hash);
        }
        for hash in previous {
            let info = self.bundles.get_mut(&hash).unwrap();
            info.refs -= 1;
            if info.refs == 0 {
                self.delete_bundle(&hash, false);
            }
        }

        self.manifest = manifest;
        self.manifest_sequence += 1;
        self.manifest_signature = None;
        self.mpc.as_ref().map(|_| self.sign_current_manifest())
    }

    pub fn set_uploaders(&mut self, uploaders: Vec<AccountId>) {
        self.assert_owner();
        self.uploaders.clear();
        self.uploaders.extend(uploaders);
    }

    pub fn set_limits(&mut self, limits: Limits) {
        self.assert_owner();
        self.limits = limits;
    }

    /// Changing the key breaks clients that pinned the old one, plan a rotation.
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

    // ---------------------------------------------------------------- MPC signature

    /// Re-requests the signature of the current manifest, e.g. after an MPC timeout. Open to anyone:
    /// it can only sign what is already on-chain.
    pub fn request_manifest_signature(&mut self) -> Promise {
        require!(self.manifest_sequence > 0, "No manifest");
        require!(self.manifest_signature.is_none(), "Manifest is already signed");
        self.sign_current_manifest()
    }

    #[private]
    pub fn on_manifest_signed(&mut self, sequence: u64, sha256: String, #[callback_result] response: Result<Value, PromiseError>) -> bool {
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

    // ---------------------------------------------------------------- views

    /// Raw bundle bytes of a wallet in the current manifest (gzip or plain, as uploaded).
    pub fn get_code(&self, wallet_id: String) {
        let hash = self.wallets.get(&wallet_id).unwrap_or_else(|| env::panic_str(&format!("No bundle for {wallet_id}")));
        env::value_return(self.bundle_data.get(hash).unwrap());
    }

    /// Manifest plus signature in one envelope; the same JSON can be mirrored to a CDN as is.
    pub fn get_signed_manifest(&self) -> SignedManifest {
        SignedManifest { manifest: self.manifest.clone(), signature: self.manifest_signature.clone() }
    }

    /// Raw manifest JSON (not wrapped in a JSON string).
    pub fn get_manifest(&self) {
        env::value_return(self.manifest.as_bytes());
    }

    pub fn get_manifest_sequence(&self) -> u64 {
        self.manifest_sequence
    }

    pub fn get_wallets(&self) -> BTreeMap<String, String> {
        self.wallets.iter().map(|(id, hash)| (id.clone(), to_hex(hash))).collect()
    }

    pub fn get_bundle_info(&self, sha256: String) -> Option<BundleInfo> {
        self.bundles.get(&parse_hash(&sha256)).cloned()
    }

    /// Uploaded bundles no wallet uses yet (waiting for a manifest, or to be pruned).
    pub fn get_pending(&self) -> Vec<(String, BundleInfo)> {
        self.bundles.iter().filter(|(_, info)| info.refs == 0).map(|(hash, info)| (to_hex(hash), info.clone())).collect()
    }

    pub fn get_pending_bytes(&self) -> u64 {
        self.pending_bytes
    }

    pub fn get_uploaders(&self) -> Vec<AccountId> {
        self.uploaders.iter().cloned().collect()
    }

    pub fn get_limits(&self) -> Limits {
        self.limits.clone()
    }

    pub fn get_mpc_config(&self) -> Option<MpcConfig> {
        self.mpc.clone()
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }
}

impl Registry {
    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the owner");
    }

    /// Wallets whose `executor` (string or list) points at `onchain:<this contract>:`, with their `sha256`.
    fn served_wallets(&self, manifest: &Value) -> BTreeMap<String, Hash> {
        let prefix = format!("onchain:{}:", env::current_account_id());
        let wallets = manifest["wallets"].as_array().unwrap_or_else(|| env::panic_str("Manifest must have a wallets array"));
        let mut served = BTreeMap::new();
        for wallet in wallets {
            let executor = &wallet["executor"];
            let sources: Vec<&str> = match executor {
                Value::String(s) => vec![s.as_str()],
                Value::Array(list) => list.iter().filter_map(|s| s.as_str()).collect(),
                _ => vec![],
            };
            if !sources.iter().any(|s| s.starts_with(&prefix)) {
                continue;
            }
            let id = wallet["id"].as_str().unwrap_or_else(|| env::panic_str("Wallet without id"));
            let sha = wallet["sha256"].as_str().unwrap_or_else(|| env::panic_str(&format!("Wallet {id} is served on-chain but has no sha256")));
            require!(served.insert(id.to_string(), parse_hash(sha)).is_none(), format!("Duplicate wallet id {id}"));
        }
        served
    }

    fn add_ref(&mut self, hash: &Hash) {
        let info = self.bundles.get_mut(hash).unwrap();
        if info.refs == 0 {
            self.pending_bytes -= info.size;
        }
        info.refs += 1;
    }

    /// `pending`: the bundle was never published, so it counts towards `pending_bytes`.
    fn delete_bundle(&mut self, hash: &Hash, pending: bool) {
        let info = self.bundles.remove(hash).unwrap();
        self.bundle_data.remove(hash);
        if pending {
            self.pending_bytes -= info.size;
        }
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
fn parse_ed25519_response(response: &Value) -> [u8; 64] {
    require!(response["scheme"] == "Ed25519", "Expected an Ed25519 signature from MPC");
    let bytes: Vec<u8> = serde_json::from_value(response["signature"].clone()).unwrap_or_else(|_| env::panic_str("Malformed MPC signature"));
    bytes.try_into().unwrap_or_else(|_| env::panic_str("Ed25519 signature must be 64 bytes"))
}

fn assert_ed25519(key: &PublicKey) {
    require!(key.curve_type() == CurveType::ED25519, "MPC public key must be ed25519");
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
    use ed25519_dalek::{Signer, SigningKey};
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const REGISTRY: &str = "registry.near";

    fn dao() -> AccountId {
        "devhub.sputnik-dao.near".parse().unwrap()
    }
    fn bot() -> AccountId {
        "bot.near".parse().unwrap()
    }
    fn alice() -> AccountId {
        "alice.near".parse().unwrap()
    }

    fn ctx_at(caller: AccountId, input: Vec<u8>, timestamp: u64) {
        let mut context = VMContextBuilder::new()
            .current_account_id(REGISTRY.parse().unwrap())
            .predecessor_account_id(caller)
            .account_balance(NearToken::from_near(100))
            .block_timestamp(timestamp)
            .build();
        context.input = input.into();
        testing_env!(context);
    }

    fn ctx(caller: AccountId) {
        ctx_at(caller, vec![], 0);
    }

    fn sha(code: &[u8]) -> Hash {
        env::sha256_array(code)
    }

    /// Uploads `code` (as plain bytes) and returns its hex hash.
    fn upload(r: &mut Registry, code: &[u8]) -> String {
        ctx_at(bot(), [sha(code).as_slice(), code].concat(), 0);
        r.upload_bundle()
    }

    fn manifest(wallets: &[(&str, &[u8])]) -> String {
        let wallets: Vec<Value> = wallets
            .iter()
            .map(|(id, code)| json!({ "id": id, "executor": [format!("onchain:{REGISTRY}:get_code"), "https://cdn/x.js"], "sha256": to_hex(&sha(code)) }))
            .collect();
        json!({ "version": "1", "wallets": wallets }).to_string()
    }

    fn registry(mpc: Option<MpcConfig>) -> Registry {
        ctx(dao());
        Registry::new(dao(), mpc, vec![bot()])
    }

    fn set_manifest(r: &mut Registry, m: String) {
        ctx(dao());
        r.set_manifest(m);
    }

    #[test]
    fn manifest_is_the_release() {
        let mut r = registry(None);
        upload(&mut r, b"hot v1");
        upload(&mut r, b"meteor v1");
        assert_eq!(r.get_pending_bytes(), 15);

        set_manifest(&mut r, manifest(&[("hot", b"hot v1"), ("meteor", b"meteor v1")]));
        assert_eq!(r.get_wallets().len(), 2);
        assert_eq!(r.get_pending_bytes(), 0);
        assert_eq!(r.get_manifest_sequence(), 1);
    }

    #[test]
    fn replaced_bundles_are_deleted_fresh_uploads_survive() {
        let mut r = registry(None);
        let v1 = upload(&mut r, b"hot v1");
        set_manifest(&mut r, manifest(&[("hot", b"hot v1")]));

        let v2 = upload(&mut r, b"hot v2");
        let v3 = upload(&mut r, b"hot v3"); // uploaded for a later proposal
        set_manifest(&mut r, manifest(&[("hot", b"hot v2")]));

        assert!(r.get_bundle_info(v1).is_none(), "v1 was replaced and must be deleted");
        assert_eq!(r.get_bundle_info(v2).unwrap().refs, 1);
        assert_eq!(r.get_bundle_info(v3.clone()).unwrap().refs, 0, "pending upload must survive");
        assert_eq!(r.get_pending_bytes(), 6);
        assert_eq!(r.get_pending().len(), 1);

        set_manifest(&mut r, manifest(&[("hot", b"hot v3")]));
        assert_eq!(r.get_pending_bytes(), 0);
    }

    #[test]
    fn shared_bundle_survives_while_any_wallet_uses_it() {
        let mut r = registry(None);
        let shared = upload(&mut r, b"shared");
        upload(&mut r, b"other");
        set_manifest(&mut r, manifest(&[("a", b"shared"), ("b", b"shared")]));
        assert_eq!(r.get_bundle_info(shared.clone()).unwrap().refs, 2);

        set_manifest(&mut r, manifest(&[("a", b"shared"), ("b", b"other")]));
        assert_eq!(r.get_bundle_info(shared).unwrap().refs, 1);
    }

    #[test]
    fn wallets_not_served_onchain_are_not_indexed() {
        let mut r = registry(None);
        let m = json!({ "wallets": [{ "id": "cdn-only", "executor": "https://cdn/x.js" }] }).to_string();
        set_manifest(&mut r, m);
        assert!(r.get_wallets().is_empty());
    }

    #[test]
    #[should_panic(expected = "is not uploaded")]
    fn manifest_requires_uploaded_bundles() {
        let mut r = registry(None);
        set_manifest(&mut r, manifest(&[("hot", b"missing")]));
    }

    #[test]
    #[should_panic(expected = "is served on-chain but has no sha256")]
    fn onchain_wallet_needs_sha256() {
        let mut r = registry(None);
        let m = json!({ "wallets": [{ "id": "hot", "executor": format!("onchain:{REGISTRY}:get_code") }] }).to_string();
        set_manifest(&mut r, m);
    }

    #[test]
    #[should_panic(expected = "Not an uploader")]
    fn only_uploaders_upload() {
        let mut r = registry(None);
        ctx_at(alice(), [sha(b"x").as_slice(), b"x"].concat(), 0);
        r.upload_bundle();
    }

    #[test]
    #[should_panic(expected = "Pending uploads limit reached")]
    fn pending_limit_bounds_uploads() {
        let mut r = registry(None);
        ctx(dao());
        r.set_limits(Limits { max_pending_bytes: 10, pending_ttl_ns: 1 });
        upload(&mut r, b"123456");
        upload(&mut r, b"abcdef");
    }

    #[test]
    fn prune_after_ttl_by_anyone() {
        let mut r = registry(None);
        let h = upload(&mut r, b"orphan");
        ctx_at(alice(), vec![], DEFAULT_PENDING_TTL_NS);
        r.prune(h.clone());
        assert!(r.get_bundle_info(h).is_none());
        assert_eq!(r.get_pending_bytes(), 0);
    }

    #[test]
    #[should_panic(expected = "Bundle is not expired yet")]
    fn prune_before_ttl_is_restricted() {
        let mut r = registry(None);
        let h = upload(&mut r, b"orphan");
        ctx_at(alice(), vec![], DEFAULT_PENDING_TTL_NS - 1);
        r.prune(h);
    }

    #[test]
    #[should_panic(expected = "Bundle is used by the current manifest")]
    fn published_bundle_cannot_be_pruned() {
        let mut r = registry(None);
        let h = upload(&mut r, b"hot v1");
        set_manifest(&mut r, manifest(&[("hot", b"hot v1")]));
        ctx(dao());
        r.prune(h);
    }

    #[test]
    #[should_panic(expected = "Only the owner")]
    fn only_owner_sets_manifest() {
        let mut r = registry(None);
        ctx(bot());
        r.set_manifest(manifest(&[]));
    }

    // ---------------------------------------------------------------- MPC

    fn mpc_key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    fn mpc_config() -> MpcConfig {
        let mut key = vec![0u8]; // ed25519 curve tag
        key.extend_from_slice(mpc_key().verifying_key().as_bytes());
        MpcConfig { contract_id: "v1.signer".parse().unwrap(), path: "near-connect/manifest".into(), domain_id: 1, public_key: PublicKey::try_from(key).unwrap() }
    }

    /// Simulates the MPC callback with `response` as the `sign` result (None = failed promise).
    fn callback(r: &mut Registry, sequence: u64, sha256: String, response: Option<Value>) -> bool {
        ctx(REGISTRY.parse().unwrap());
        r.on_manifest_signed(sequence, sha256, response.ok_or(PromiseError::Failed))
    }

    fn signed_registry() -> (Registry, String) {
        let mut r = registry(Some(mpc_config()));
        let m = manifest(&[]);
        ctx(dao());
        assert!(r.set_manifest(m.clone()).is_some());
        (r, to_hex(&sha(m.as_bytes())))
    }

    fn sign(seq: u64, sha: &str, key: &SigningKey) -> Value {
        json!({ "scheme": "Ed25519", "signature": key.sign(&manifest_message(seq, &parse_hash(sha))).to_bytes().to_vec() })
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
        let args: Value = serde_json::from_slice(args).unwrap();
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
        assert!(callback(&mut r, 1, sha.clone(), Some(sign(1, &sha, &mpc_key()))));
        let signed = r.get_signed_manifest().signature.unwrap();
        assert_eq!((signed.sequence, signed.sha256), (1, sha));
    }

    #[test]
    #[should_panic(expected = "MPC signature does not verify")]
    fn rejects_a_signature_from_another_key() {
        let (mut r, sha) = signed_registry();
        callback(&mut r, 1, sha.clone(), Some(sign(1, &sha, &SigningKey::from_bytes(&[9u8; 32]))));
    }

    #[test]
    fn ignores_stale_and_failed_signatures() {
        let (mut r, sha) = signed_registry();
        assert!(!callback(&mut r, 1, sha.clone(), None));
        assert!(r.get_signed_manifest().signature.is_none());

        set_manifest(&mut r, json!({ "version": "2", "wallets": [] }).to_string());
        assert!(!callback(&mut r, 1, sha.clone(), Some(sign(1, &sha, &mpc_key()))));
        assert!(r.get_signed_manifest().signature.is_none());
    }

    /// Prints a cross-language test vector: `cargo test print_vector -- --nocapture`
    #[test]
    fn print_vector() {
        let msg = manifest_message(42, &sha(br#"{"wallets":[]}"#));
        let key = mpc_key();
        println!("VECTOR {} {} {}", to_hex(&msg), to_hex(key.verifying_key().as_bytes()), to_hex(&key.sign(&msg).to_bytes()));
    }
}
