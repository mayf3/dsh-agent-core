use super::*;
use crate::{common::*, trust::digest, verification::native::VerifiedCanary};
use sha2::{Digest, Sha256};
#[test]
fn separate_exact_activation_requires_current_pass_and_genuine_private_canary_proof() {
    for case in [
        "pass",
        "expired",
        "wrong-baseline",
        "wrong-generation",
        "pending-goal",
        "global-unsafe",
    ] {
        let (_tmp, roots, q, mut c, p, mut e, mut g) = super::adopted_baseline_tests::setup();
        let key = ed25519_dalek::SigningKey::from_bytes(&Sha256::digest(b"local-verifier").into());
        c.keys.insert(
            "local-verifier".into(),
            TrustedKey {
                public_key: hex::encode(key.verifying_key().as_bytes()),
                role: Role::Verifier,
                scopes: vec!["fixture".into()],
            },
        );
        c.profiles
            .get_mut("fixture")
            .unwrap()
            .goal_verifiers
            .insert("verify-1".into(), "local-verifier".into());
        g.payload.profile_digest =
            crate::bootstrap::profile_digest(&c.profiles["fixture"]).unwrap();
        g = signed("authority", g.payload);
        let guard = roots.lock().unwrap();
        let r = e
            .adopt_existing(&guard, &q, &c, &actor(), &p, &g, 1000)
            .unwrap();
        let mut current = q
            .daemon_current_installation(&r.target_runtime)
            .unwrap()
            .unwrap();
        let goal = signed(
            "local-verifier",
            GoalReceipt {
                unit_id: r.unit_id.clone(),
                goal_id: g.payload.release.goal_id.clone(),
                acceptance_revision: g.payload.release.acceptance_revision.clone(),
                target_generation: 1,
                attempt: 0,
                service_generation: current.service_generation.clone(),
                attachment_digest: q
                    .daemon_goal_attachment(&r.unit_id, &g.payload.release.goal_id)
                    .unwrap(),
                outcome: if case == "pending-goal" {
                    GoalOutcome::WaitingExternalAcceptance
                } else {
                    GoalOutcome::Pass
                },
                evidence_digest: "e".repeat(64),
                revision: 1,
            },
        );
        q.record_goal(&c, &goal).unwrap();
        let mut a = StandingActivationGrant {
            version: 1,
            adoption_grant_digest: digest(&g).unwrap(),
            baseline_receipt_digest: digest(&r).unwrap(),
            canary_plan_digest: g.payload.canary_plan_digest.clone(),
            owner_acceptance_digest: "f".repeat(64),
            issued_at: 999,
            expires_at: 1100,
        };
        if case == "expired" {
            a.expires_at = 1000;
        }
        if case == "wrong-baseline" {
            a.baseline_receipt_digest = "a".repeat(64);
        }
        if case == "wrong-generation" {
            current.service_generation = "different".into();
        }
        if case == "global-unsafe" {
            q.latch_executor_failure(&"d".repeat(64)).unwrap();
        }
        let result = e.complete_adoption_activation(
            &guard,
            &q,
            &c,
            &g,
            &signed("authority", a),
            VerifiedCanary::fixture(current, digest(&g).unwrap()),
            &goal,
            1000,
        );
        if case == "pass" {
            let standing = result.unwrap();
            q.verify_first_live_startup("first-adoption", &standing)
                .unwrap();
            assert!(q
                .verify_first_live_startup("other-operation", &standing)
                .is_err());
            assert!(q
                .verify_first_live_startup("first-adoption", &"a".repeat(64))
                .is_err());
            q.require_configured_activation(Some("first-adoption"))
                .unwrap();
        } else {
            assert!(result.is_err(), "{case}");
            assert!(q.require_standing_activation().is_err());
        }
        assert_eq!(q.daemon_status(&r.unit_id).unwrap().mutating_attempts, 0);
    }
}
