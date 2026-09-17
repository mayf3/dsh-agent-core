use deployment_control_plane::{
    service::protocol::{client, Operation, Request},
    Error, Result,
};
use std::os::unix::net::UnixStream;
fn execute() -> Result<()> {
    let mut args: Vec<_> = std::env::args().skip(1).collect();
    let sandbox = args.first().is_some_and(|a| a == "--sandbox");
    if sandbox {
        args.remove(0);
    }
    if args.len() != 3 {
        return Err(Error::new("ARGUMENTS"));
    }
    let operation = match args[0].as_str() {
        "submit" => Operation::Submit {
            proposal_digest: args[2].clone(),
        },
        "status" => Operation::Status {
            unit_id: args[2].clone(),
        },
        "receipt" => Operation::Receipt {
            digest: args[2].clone(),
        },
        "cancel-pending" => Operation::CancelPending {
            unit_id: args[2].clone(),
        },
        "retry-verification" => Operation::RetryVerification {
            unit_id: args[2].clone(),
        },
        _ => return Err(Error::new("ARGUMENTS")),
    };
    let path = if sandbox {
        let path = std::env::current_dir()?;
        deployment_control_plane::fs::FixtureRoots::open(&path)?;
        path.join("control.sock")
    } else {
        "/private/var/run/agent-deployd/control.sock".into()
    };
    let value = client(
        &mut UnixStream::connect(path)?,
        &Request {
            version: 1,
            request_id: args[1].clone(),
            operation,
        },
    )?;
    println!("{}", serde_json::to_string(&value)?);
    if value.get("error").is_some() {
        return Err(Error::new("REQUEST_BLOCKED"));
    }
    Ok(())
}
fn main() {
    if let Err(e) = execute() {
        eprintln!("BLOCKED {}", e.code());
        std::process::exit(1);
    }
}
