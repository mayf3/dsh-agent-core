//! Native signature inspection only; no signing or executable invocation.
use crate::{error::require, Error, Result};
use std::ffi::c_void;
type Ref = *const c_void;
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
    fn CFRelease(value: Ref);
    fn CFStringCreateWithBytes(
        allocator: Ref,
        bytes: *const u8,
        len: isize,
        encoding: u32,
        external: u8,
    ) -> Ref;
    fn CFURLCreateFromFileSystemRepresentation(
        allocator: Ref,
        bytes: *const u8,
        len: isize,
        directory: u8,
    ) -> Ref;
    fn CFNumberCreate(allocator: Ref, kind: isize, value: *const c_void) -> Ref;
    fn CFDictionaryCreate(
        allocator: Ref,
        keys: *const Ref,
        values: *const Ref,
        count: isize,
        key_callbacks: Ref,
        value_callbacks: Ref,
    ) -> Ref;
    fn CFDictionaryGetValue(dictionary: Ref, key: Ref) -> Ref;
    fn CFDataGetLength(data: Ref) -> isize;
    fn CFDataGetBytePtr(data: Ref) -> *const u8;
}
#[link(name = "Security", kind = "framework")]
unsafe extern "C" {
    fn SecStaticCodeCreateWithPath(path: Ref, flags: u32, code: *mut Ref) -> i32;
    fn SecRequirementCreateWithString(text: Ref, flags: u32, requirement: *mut Ref) -> i32;
    fn SecStaticCodeCheckValidity(code: Ref, flags: u32, requirement: Ref) -> i32;
    fn SecCodeCopyGuestWithAttributes(
        host: Ref,
        attributes: Ref,
        flags: u32,
        guest: *mut Ref,
    ) -> i32;
    fn SecCodeCheckValidity(code: Ref, flags: u32, requirement: Ref) -> i32;
    fn SecCodeCopyStaticCode(code: Ref, flags: u32, static_code: *mut Ref) -> i32;
    fn SecCodeCopySigningInformation(code: Ref, flags: u32, information: *mut Ref) -> i32;
    static kSecGuestAttributePid: Ref;
    static kSecCodeInfoUnique: Ref;
}
struct Owned(Ref);
impl Owned {
    fn new(value: Ref) -> Result<Self> {
        require(!value.is_null(), "HOST_SIGNATURE_UNPROVEN")?;
        Ok(Self(value))
    }
    fn output(call: impl FnOnce(*mut Ref) -> i32) -> Result<Self> {
        let mut value = std::ptr::null();
        let status = call(&mut value);
        if status != 0 {
            if !value.is_null() {
                unsafe { CFRelease(value) }
            };
            return Err(Error::new("HOST_SIGNATURE_UNPROVEN"));
        }
        Self::new(value)
    }
}
impl Drop for Owned {
    fn drop(&mut self) {
        unsafe { CFRelease(self.0) }
    }
}
fn requirement(identifier: Option<&str>) -> Result<Owned> {
    let text = if let Some(id) = identifier {
        require(
            !id.is_empty()
                && id.len() < 256
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b".-_".contains(&b)),
            "HOST_SIGNATURE_IDENTITY",
        )?;
        format!("anchor apple and identifier \"{id}\"")
    } else {
        "anchor apple".into()
    };
    text_requirement(&text)
}
fn text_requirement(text: &str) -> Result<Owned> {
    let text = Owned::new(unsafe {
        CFStringCreateWithBytes(
            std::ptr::null(),
            text.as_ptr(),
            text.len() as isize,
            0x08000100,
            0,
        )
    })?;
    Owned::output(|out| unsafe { SecRequirementCreateWithString(text.0, 0, out) })
}
fn code(path: &str) -> Result<Owned> {
    require(
        path.starts_with('/') && path.len() < 4096 && !path.as_bytes().contains(&0),
        "HOST_SIGNATURE_PATH",
    )?;
    let url = Owned::new(unsafe {
        CFURLCreateFromFileSystemRepresentation(
            std::ptr::null(),
            path.as_ptr(),
            path.len() as isize,
            0,
        )
    })?;
    Owned::output(|out| unsafe { SecStaticCodeCreateWithPath(url.0, 0, out) })
}
fn unique(code: Ref) -> Result<Vec<u8>> {
    let info = Owned::output(|out| unsafe { SecCodeCopySigningInformation(code, 0, out) })?;
    let data = unsafe { CFDictionaryGetValue(info.0, kSecCodeInfoUnique) };
    require(!data.is_null(), "HOST_SIGNATURE_UNPROVEN")?;
    let size = unsafe { CFDataGetLength(data) };
    require((20..=64).contains(&size), "HOST_SIGNATURE_UNPROVEN")?;
    let bytes = unsafe { CFDataGetBytePtr(data) };
    require(!bytes.is_null(), "HOST_SIGNATURE_UNPROVEN")?;
    Ok(unsafe { std::slice::from_raw_parts(bytes, size as usize) }.to_vec())
}
pub(super) fn static_apple(path: &str, identifier: Option<&str>) -> Result<()> {
    let expected = requirement(identifier)?;
    let file = code(path)?;
    require(
        unsafe { SecStaticCodeCheckValidity(file.0, 1 << 4, expected.0) } == 0,
        "HOST_SIGNATURE_UNPROVEN",
    )
}
/// Both kernel path/birth/credentials and protected filesystem ancestry are
/// independently joined by the caller before/after this dynamic-code check.
pub(super) fn running_apple(pid: u32, path: &str, identifier: Option<&str>) -> Result<Vec<u8>> {
    running(pid, path, requirement(identifier)?)
}
fn running(pid: u32, path: &str, expected: Owned) -> Result<Vec<u8>> {
    require(pid > 0 && pid <= i32::MAX as u32, "HOST_SIGNATURE_PID")?;
    let file = code(path)?;
    require(
        unsafe { SecStaticCodeCheckValidity(file.0, 1 << 4, expected.0) } == 0,
        "HOST_SIGNATURE_UNPROVEN",
    )?;
    let pid = pid as i32;
    let number =
        Owned::new(unsafe { CFNumberCreate(std::ptr::null(), 3, (&pid as *const i32).cast()) })?;
    let key = unsafe { kSecGuestAttributePid };
    let attributes = Owned::new(unsafe {
        CFDictionaryCreate(
            std::ptr::null(),
            &key,
            &number.0,
            1,
            std::ptr::null(),
            std::ptr::null(),
        )
    })?;
    let guest = Owned::output(|out| unsafe {
        SecCodeCopyGuestWithAttributes(std::ptr::null(), attributes.0, 0, out)
    })?;
    require(
        unsafe { SecCodeCheckValidity(guest.0, 0, expected.0) } == 0,
        "HOST_SIGNATURE_UNPROVEN",
    )?;
    let running = Owned::output(|out| unsafe { SecCodeCopyStaticCode(guest.0, 0, out) })?;
    let actual = unique(running.0)?;
    require(actual == unique(file.0)?, "HOST_SIGNATURE_GENERATION")?;
    Ok(actual)
}
#[cfg(test)]
#[path = "../../../../test/first_live/host/signature.rs"]
mod tests;
pub(super) fn running_docker(pid: u32, path: &str) -> Result<Vec<u8>> {
    require(
        path == "/Library/PrivilegedHelperTools/com.docker.vmnetd",
        "HOST_DOCKER_PATH",
    )?;
    let proof=running(pid,path,text_requirement("anchor apple generic and identifier \"com.docker.vmnetd\" and certificate leaf[subject.OU] = \"9BNSXJN65R\"")?)?;
    let hex: String = proof.iter().map(|b| format!("{b:02x}")).collect();
    require(
        hex == "b0b013ccb8b9d42a7654ff2e5621f8568b277e83",
        "HOST_DOCKER_IDENTITY",
    )?;
    Ok(proof)
}
