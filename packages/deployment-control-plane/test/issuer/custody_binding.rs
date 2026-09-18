//! Runtime public-material binding tests, separate from publication effects.
use super::*;

#[test]
fn offline_template_keeps_profiles_but_must_use_actual_fresh_keys() {
    let c = Case::new();
    let proof = c.run().unwrap();
    let mut template = c.old.clone();
    template.profiles.get_mut("dsh-app").unwrap().enabled = true;
    let bound = proof.bind_catalog(&template).unwrap();
    assert_eq!(bound.keys, proof.catalog.keys);
    assert_eq!(bound.revision, proof.catalog.revision);
    assert_eq!(bound.profiles, template.profiles);
    template
        .keys
        .get_mut("local-reviewer")
        .unwrap()
        .scopes
        .push("extra".into());
    assert!(proof.bind_catalog(&template).is_err());
}

#[test]
fn issuer_templates_bind_observed_custody_and_reject_prefilled_or_widened_claims() {
    let c = Case::new();
    let proof = c.run().unwrap();
    let template: Vec<_> = c
        .old
        .keys
        .iter()
        .map(|(id, k)| crate::bootstrap::IssuerRequirement {
            proposed_key_id: id.clone(),
            role: k.role,
            scope: k.scopes.clone(),
            public_key: None,
            service_identity: Some(id.clone()),
            custody_receipt: None,
            source_binding: "fixture exact producer".into(),
        })
        .collect();
    let bound = proof.bind_issuers(&template).unwrap();
    for b in &bound {
        assert_eq!(
            b.public_key.as_ref(),
            Some(&proof.catalog.keys[&b.proposed_key_id].public_key)
        );
        assert_eq!(
            b.custody_receipt.as_deref(),
            Some(proof.completion_sha256())
        );
    }
    for variant in 0..5 {
        let mut bad = template.clone();
        match variant {
            0 => bad[0].public_key = Some(c.old.keys[&bad[0].proposed_key_id].public_key.clone()),
            1 => bad[0].custody_receipt = Some("a".repeat(64)),
            2 => bad[0].scope.push("unreviewed".into()),
            3 => bad[0].service_identity = bad[1].service_identity.clone(),
            _ => bad[0] = bad[1].clone(),
        }
        assert!(proof.bind_issuers(&bad).is_err());
    }
}

#[test]
fn issuer_template_rejected_before_entropy_or_host_effects() {
    let c = Case::new();
    let template: Vec<_> = c
        .old
        .keys
        .iter()
        .map(|(id, k)| crate::bootstrap::IssuerRequirement {
            proposed_key_id: id.clone(),
            role: k.role,
            scope: k.scopes.clone(),
            public_key: None,
            service_identity: Some(id.clone()),
            custody_receipt: None,
            source_binding: "fixture public source".into(),
        })
        .collect();
    validate_issuer_template(&template, &c.old).unwrap();
    for variant in 0..7 {
        let mut bad = template.clone();
        match variant {
            0 => {
                bad.pop();
            }
            1 => bad[0].public_key = Some("a".repeat(64)),
            2 => bad[0].custody_receipt = Some("b".repeat(64)),
            3 => bad[0].scope.push("other".into()),
            4 => bad[0].service_identity = bad[1].service_identity.clone(),
            5 => bad[0].source_binding.clear(),
            _ => bad[0] = bad[1].clone(),
        }
        assert!(
            validate_issuer_template(&bad, &c.old).is_err(),
            "variant {variant}"
        );
    }
    assert!(!c
        .roots
        .root
        .names()
        .unwrap()
        .contains(&"custody-transition".to_string()));
}
