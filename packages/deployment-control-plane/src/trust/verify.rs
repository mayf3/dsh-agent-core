use crate::{model::*, Result};
use serde::Serialize;
pub fn canonical_bytes<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    Ok(serde_json::to_vec(&serde_json::to_value(value)?)?)
}
pub fn digest<T: Serialize>(value: &T) -> Result<String> {
    use sha2::{Digest, Sha256};
    Ok(hex::encode(Sha256::digest(canonical_bytes(value)?)))
}
pub trait Signable: Serialize {
    const DOMAIN: &'static str;
    const ROLE: Role;
}
macro_rules! signable {
    ($($ty:ty => $role:ident),*) => { $(impl Signable for $ty {
        const DOMAIN: &'static str = stringify!($ty);
        const ROLE: Role = Role::$role;
    })* };
}
signable!(Acceptance => Authority, Policy => Authority, DesiredState => Authority,
    BuildAttestation => Builder, Review => Reviewer, ReadyRecord => Producer,
    ProducerSnapshot => Producer, ClosureAcknowledgement => Producer, GoalReceipt => Verifier, RecoveryEvidence => Recovery);
pub fn signing_bytes<T: Signable>(value: &T) -> Result<Vec<u8>> {
    let mut bytes = format!("agent-deployd:v1:{}:", T::DOMAIN).into_bytes();
    bytes.extend(canonical_bytes(value)?);
    Ok(bytes)
}
pub fn verify_signed<T: Signable>(
    record: &Signed<T>,
    catalog: &Catalog,
    scope: &str,
) -> Result<()> {
    use crate::{error::require, Error};
    use ed25519_dalek::{Signature, VerifyingKey};
    let key = catalog
        .keys
        .get(&record.issuer)
        .ok_or(Error::new("UNKNOWN_ISSUER"))?;
    require(key.role == T::ROLE, "ISSUER_ROLE")?;
    require(key.scopes.iter().any(|s| s == scope), "ISSUER_SCOPE")?;
    let raw: [u8; 32] = hex::decode(&key.public_key)
        .map_err(|_| Error::new("INVALID_KEY"))?
        .try_into()
        .map_err(|_| Error::new("INVALID_KEY"))?;
    let verifier = VerifyingKey::from_bytes(&raw).map_err(|_| Error::new("INVALID_KEY"))?;
    let bytes = hex::decode(&record.signature).map_err(|_| Error::new("INVALID_SIGNATURE"))?;
    let signature = Signature::from_slice(&bytes).map_err(|_| Error::new("INVALID_SIGNATURE"))?;
    verifier
        .verify_strict(&signing_bytes(&record.payload)?, &signature)
        .map_err(|_| Error::new("INVALID_SIGNATURE"))
}
