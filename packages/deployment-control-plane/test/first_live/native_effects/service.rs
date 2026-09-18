use super::*;
use crate::transaction::NativeKind;
#[test]
fn maintenance_requires_exact_complete_original_loaded_group() {
    let kinds = [
        NativeKind::Runtime,
        NativeKind::WatchdogW1,
        NativeKind::WatchdogW2,
    ];
    let mut components: Vec<_> = kinds
        .iter()
        .map(|kind| ComponentImage {
            kind: *kind,
            loaded: true,
            disabled: false,
            running: false,
            process: None,
            runs: 0,
            last_exit: Some(0),
        })
        .collect();
    let loaded = kinds.iter().map(|k| (k.label().to_owned(), true)).collect();
    let disabled = kinds
        .iter()
        .map(|k| (k.label().to_owned(), false))
        .collect();
    validate_group(&components, &loaded, &disabled).unwrap();
    components[1].disabled = true;
    assert!(validate_group(&components, &loaded, &disabled).is_err());
    components[1].disabled = false;
    components.pop();
    assert!(validate_group(&components, &loaded, &disabled).is_err());
}
