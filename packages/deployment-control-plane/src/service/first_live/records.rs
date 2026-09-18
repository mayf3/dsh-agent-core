use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Pending {
    pub operation_id: String,
    pub package_digest: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Core {
    pub version: u32,
    pub operation_id: String,
    pub packet_sha256: String,
    pub grant_sha256: String,
    pub lifecycle_digest: String,
    pub host_safety_receipt_digest: String,
    pub custody_completion_digest: String,
    pub reviewer_login_receipt_digest: String,
    pub standing_receipt_digest: String,
    pub state: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Binding {
    pub operation_id: String,
    pub package_digest: String,
    pub grant_digest: String,
    pub controller_digest: String,
    pub core_digest: String,
    pub configuration_digest: String,
    pub activation_digest: String,
    pub standing_digest: String,
    pub plist_before_digest: String,
    pub plist_after_digest: String,
    pub expires_at: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Readback {
    pub binding: Binding,
    pub process: crate::transaction::ProcessIdentity,
    pub socket_device: u64,
    pub socket_inode: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Admission {
    pub binding: Binding,
    pub readback_digest: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Ready {
    pub admission_digest: String,
    pub readback: Readback,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub(super) struct Complete {
    pub binding: Binding,
    pub readback_digest: String,
    pub ready_digest: String,
}
