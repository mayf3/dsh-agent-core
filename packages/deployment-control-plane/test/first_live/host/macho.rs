use super::*;
fn image(command: u32, path: &str) -> Vec<u8> {
    let mut b = vec![0u8; 32];
    b[0..4].copy_from_slice(&0xfeedfacfu32.to_le_bytes());
    b[4..8].copy_from_slice(&0x01000007u32.to_le_bytes());
    let len = (24 + path.len() + 1).div_ceil(8) * 8;
    b[16..20].copy_from_slice(&1u32.to_le_bytes());
    b[20..24].copy_from_slice(&(len as u32).to_le_bytes());
    let mut c = vec![0u8; len];
    c[0..4].copy_from_slice(&command.to_le_bytes());
    c[4..8].copy_from_slice(&(len as u32).to_le_bytes());
    c[8..12].copy_from_slice(&24u32.to_le_bytes());
    c[24..24 + path.len()].copy_from_slice(path.as_bytes());
    b.extend(c);
    b
}
#[test]
fn exact_absolute_loads_preserved_and_dynamic_search_rejected() {
    let b = image(12, "/usr/lib/libSystem.B.dylib");
    assert_eq!(
        dependencies(&b, 0x01000007).unwrap(),
        vec!["/usr/lib/libSystem.B.dylib"]
    );
    for cmd in [0x8000001c, 0x27] {
        assert!(dependencies(&image(cmd, "@rpath/unsafe"), 0x01000007).is_err());
    }
}
#[test]
fn relative_loader_truncation_architecture_and_unknown_command_refuse() {
    for b in [
        image(12, "@rpath/test"),
        image(999, "x"),
        image(12, "/usr/lib/a")[..34].to_vec(),
    ] {
        assert!(dependencies(&b, 0x01000007).is_err());
    }
    assert!(dependencies(&image(12, "/usr/lib/a"), 0x0100000c).is_err());
}
#[test]
fn universal_images_select_exact_cpu_once_with_bounded_slice() {
    let thin = image(12, "/usr/lib/libSystem.B.dylib");
    let mut b = vec![0u8; 28];
    b[0..4].copy_from_slice(&0xcafebabeu32.to_be_bytes());
    b[4..8].copy_from_slice(&1u32.to_be_bytes());
    b[8..12].copy_from_slice(&0x01000007u32.to_be_bytes());
    b[16..20].copy_from_slice(&28u32.to_be_bytes());
    b[20..24].copy_from_slice(&(thin.len() as u32).to_be_bytes());
    b.extend(thin);
    assert_eq!(dependencies(&b, 0x01000007).unwrap().len(), 1);
    b[20..24].copy_from_slice(&u32::MAX.to_be_bytes());
    assert!(dependencies(&b, 0x01000007).is_err());
}
