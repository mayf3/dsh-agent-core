use super::*;
use std::{net::TcpListener, time::Instant};
#[test]
fn dribbling_peer_cannot_extend_total_deadline() {
    crate::common::private::nonroot();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let peer = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        for _ in 0..20 {
            if stream.write_all(b"x").is_err() {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    });
    let started = Instant::now();
    let result = probe(addr, Duration::from_millis(100));
    let elapsed = started.elapsed();
    peer.join().unwrap();
    assert_eq!(result.unwrap_err().code(), "HEALTH_TIMEOUT");
    assert!(elapsed < Duration::from_millis(300), "{elapsed:?}");
}

#[test]
fn bounded_reader_accepts_health_and_rejects_known_failure() {
    crate::common::private::nonroot();
    for healthy in [true, false] {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let peer = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = [0; 1024];
            let _ = stream.read(&mut request).unwrap();
            stream
                .write_all(
                    format!("HTTP/1.1 200 OK\r\nConnection: close\r\n\r\n{{\"ok\":{healthy}}}")
                        .as_bytes(),
                )
                .unwrap();
        });
        let result = probe(addr, Duration::from_millis(500));
        peer.join().unwrap();
        if healthy {
            result.unwrap();
        } else {
            assert_eq!(result.unwrap_err().code(), "HEALTH_FAILED");
        }
    }
}
