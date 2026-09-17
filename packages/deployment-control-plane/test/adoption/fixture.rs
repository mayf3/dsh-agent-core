pub fn nonroot() {
    crate::common::private::nonroot();
}
pub fn temp() -> tempfile::TempDir {
    nonroot();
    crate::common::private::temp()
}
