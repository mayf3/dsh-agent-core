use super::*;
use std::{
    io::{Read, Write},
    time::Duration,
};
#[test]
fn authenticated_same_stream_survives_real_darwin_peer_fin() {
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("status.sock");
    let listener = std::os::unix::net::UnixListener::bind(&path).unwrap();
    let child = std::thread::spawn(move || {
        let (mut server, _) = listener.accept().unwrap();
        let mut b = [0; 1];
        let mut req = vec![];
        while !req.ends_with(b"\r\n\r\n") {
            server.read_exact(&mut b).unwrap();
            req.push(b[0]);
        }
        server.write_all(b"HTTP/1.0 200 OK\r\n\r\n{\"BackendState\":\"Running\",\"Self\":{\"ID\":\"fixture\",\"PublicKey\":\"public\"}}").unwrap();
    });
    let mut client = UnixStream::connect(path).unwrap();
    let expected = Peer {
        uid: unsafe { libc::getuid() },
        gid: unsafe { libc::getgid() },
        pid: std::process::id(),
    };
    let mut checks = 0;
    let response = authenticated_exchange(
        &mut client,
        expected,
        Instant::now() + Duration::from_secs(1),
        || {
            checks += 1;
            Ok(())
        },
    );
    child.join().unwrap();
    assert!(super::super::status::parse(&response.unwrap()).is_ok());
    assert_eq!(checks, 2);
}
#[test]
fn authenticated_exchange_rejects_mismatched_peer_before_any_request() {
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("status.sock");
    let listener = std::os::unix::net::UnixListener::bind(&path).unwrap();
    let mut client = UnixStream::connect(path).unwrap();
    let (mut server, _) = listener.accept().unwrap();
    let expected = Peer {
        uid: unsafe { libc::getuid() },
        gid: unsafe { libc::getgid() },
        pid: std::process::id() + 1,
    };
    let result = authenticated_exchange(
        &mut client,
        expected,
        Instant::now() + Duration::from_secs(1),
        || panic!("wrong peer admitted"),
    );
    assert!(result.is_err());
    server.set_nonblocking(true).unwrap();
    assert_eq!(
        server.read(&mut [0u8; 1]).unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
}
#[test]
fn immediate_fin_and_delayed_body_complete_with_one_total_deadline() {
    for delay in [0, 20] {
        let (mut client, mut server) = UnixStream::pair().unwrap();
        let child = std::thread::spawn(move || {
            let mut request = vec![];
            let mut b = [0u8; 1];
            while !request.ends_with(b"\r\n\r\n") {
                server.read_exact(&mut b).unwrap();
                request.push(b[0]);
            }
            assert_eq!(request,b"GET /localapi/v0/status?peers=false HTTP/1.0\r\nHost: local-tailscaled.sock\r\nConnection: close\r\n\r\n");
            std::thread::sleep(Duration::from_millis(delay));
            server.write_all(b"response").unwrap();
        });
        let result = exchange(&mut client, Instant::now() + Duration::from_secs(1));
        assert_eq!(result.unwrap(), b"response");
        child.join().unwrap();
    }
}
#[test]
fn hung_peer_and_continuous_stream_cannot_extend_total_budget() {
    for stream in [false, true] {
        let (mut client, mut server) = UnixStream::pair().unwrap();
        let child = std::thread::spawn(move || {
            let mut b = [0u8; 256];
            let _ = server.read(&mut b);
            if stream {
                for _ in 0..100 {
                    if server.write_all(b"x").is_err() {
                        break;
                    };
                    std::thread::sleep(Duration::from_millis(2));
                }
            } else {
                std::thread::sleep(Duration::from_millis(150));
            }
        });
        let start = Instant::now();
        assert!(exchange(&mut client, start + Duration::from_millis(40)).is_err());
        assert!(start.elapsed() < Duration::from_millis(120));
        drop(client);
        child.join().unwrap();
    }
}
