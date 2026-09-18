//! Explicit genesis installation. No invocation installs implicitly or enables a service.
use deployment_control_plane::{bootstrap::*, Error, Result};
use std::path::Path;
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
fn pins(args: &[String]) -> GenesisPins {
    GenesisPins {
        plan_digest: args[0].clone(),
        package_digest: args[1].clone(),
        source_digest: args[2].clone(),
        review_record_digest: args[3].clone(),
        initial_registry_digest: args[4].clone(),
        supervisor_policy_digest: args[5].clone(),
    }
}
fn print(value: &impl serde::Serialize) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}
fn run() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("template") if args.len() == 2 => {
            if unsafe { libc::geteuid() } == 0 {
                return Err(Error::new("PREPARATION_REFUSES_ROOT"));
            }
            print(
                &serde_json::json!({"paths":genesis_paths(),"identities":genesis_identities(),
                "roles":genesis_roles(),"operations":GenesisOperation::REQUIRED,
                "abort_conditions":GenesisAbort::REQUIRED,"rollback":GenesisRollback::REQUIRED,
                "future_outputs":GenesisFutureOutput::REQUIRED,"required_review_scopes":GenesisReviewScope::REQUIRED,
                "host":observed_host()?}),
            )
        }
        Some("verify") if args.len() == 9 => {
            if unsafe { libc::geteuid() } == 0 {
                return Err(Error::new("PREPARATION_REFUSES_ROOT"));
            }
            let pins = pins(&args[3..]);
            let (plan, artifacts) = load_genesis_package(Path::new(&args[2]), &pins)?;
            print(&verify_genesis_artifacts(&plan, &pins, &artifacts)?)
        }
        Some(action @ ("install" | "reviewer-login" | "login-child" | "rollback"))
            if args.len() == 10 =>
        {
            if unsafe { libc::geteuid() } != 0 {
                return Err(Error::new("ROOT_REQUIRED"));
            }
            let pins = pins(&args[4..]);
            let package = Path::new(&args[2]);
            let authorization = Path::new(&args[3]);
            match action {
                "install" => print(&install_genesis_native(package, authorization, &pins)?),
                "reviewer-login" => print(&login_genesis_reviewer(package, authorization, &pins)?),
                "rollback" => print(&rollback_genesis_files(package, authorization, &pins)?),
                _ => genesis_login_child(package, authorization, &pins),
            }
        }
        _ => Err(Error::new(
            "USAGE_TEMPLATE_VERIFY_INSTALL_REVIEWER_LOGIN_ROLLBACK",
        )),
    }
}
