//! Closed privileged refusal surface; no argument parsing or child execution.
fn main() {
    eprintln!("Legacy deployment entry retired; use agent-deployctl.");
    std::process::exit(64);
}
