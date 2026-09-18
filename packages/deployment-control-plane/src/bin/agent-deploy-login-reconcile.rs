fn main() {
    let args: Vec<String> = std::env::args().collect();
    let result = if args.len() == 2 {
        deployment_control_plane::bootstrap::login_reconciliation(&args[1])
    } else {
        Err(deployment_control_plane::Error::new("USAGE"))
    };
    match result {
        Ok(()) => println!(
            "LOGIN_RECONCILIATION_COMMAND_COMPLETED; ORIGINAL_OUTCOME_UNKNOWN; ACTIVATION_DISABLED"
        ),
        Err(error) => {
            eprintln!("{}", error.code());
            std::process::exit(1);
        }
    }
}
