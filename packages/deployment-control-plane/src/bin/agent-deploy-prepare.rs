//! Nonprivileged offline package preparation; never an installation entry.
use deployment_control_plane::{
    bootstrap::{generate, verify_bundle, verify_sources},
    trust::digest,
};
use serde::Deserialize;
use std::{collections::BTreeMap, path::Path};
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Input {
    source_revision: String,
    source_files: BTreeMap<String, String>,
    controller: String,
    runtime: BTreeMap<String, String>,
    platform_tools: BTreeMap<String, String>,
}
fn main() {
    if let Err(e) = run() {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
fn run() -> Result<(), Box<dyn std::error::Error>> {
    if unsafe { libc::geteuid() } == 0 {
        return Err("PREPARATION_REFUSES_ROOT".into());
    }
    let args: Vec<_> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("prepare") if args.len()==4 => {
            let raw=std::fs::read(&args[2])?;
            if raw.len()>4*1024*1024 { return Err("SIZE_LIMIT".into()); }
            let input:Input=serde_json::from_slice(&raw)?;
            if input.runtime.len()>64 { return Err("SIZE_LIMIT".into()); }
            let mut runtime=BTreeMap::new(); let mut total=0;
            for (dest,path) in input.runtime {
                let bytes=bounded(&path)?;total+=bytes.len();
                if total>512*1024*1024 { return Err("SIZE_LIMIT".into()); }
                runtime.insert(dest,bytes);
            }
            let source=digest(&input.source_files)?;
            let hash=generate(Path::new(&args[3]), &input.source_revision,input.source_files,&bounded(&input.controller)?, &runtime,input.platform_tools)?;
            let verdict=verify_bundle(Path::new(&args[3]),&hash,&source)?;
            println!("{}",serde_json::to_string_pretty(&serde_json::json!({"manifest_digest":hash,"source_digest":source,"verdict":verdict}))?);
        }
        Some("verify") if args.len()==6 => {
            let result=verify_bundle(Path::new(&args[2]),&args[3],&args[4])?;
            verify_sources(Path::new(&args[2]),Path::new(&args[5]))?;
            println!("{}",serde_json::to_string_pretty(&result)?);
        }
        _=>return Err("usage: agent-deploy-prepare prepare INPUT_JSON NEW_EMPTY_DIR | verify BUNDLE MANIFEST_DIGEST SOURCE_DIGEST CHECKOUT".into()),
    }
    Ok(())
}
fn bounded(path: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    use std::{
        fs::OpenOptions,
        io::Read,
        os::unix::fs::{MetadataExt, OpenOptionsExt},
    };
    let f = OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(path)?;
    let m = f.metadata()?;
    if !m.is_file() || m.nlink() != 1 || m.len() > 128 * 1024 * 1024 {
        return Err("UNSAFE_INPUT".into());
    }
    let mut bytes = Vec::new();
    f.take(128 * 1024 * 1024 + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 != m.len() {
        return Err("INPUT_CHANGED".into());
    }
    Ok(bytes)
}
