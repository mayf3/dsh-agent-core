// Frozen data from the original JS postdeploy verifier test; never runtime evidence.
pub(crate) fn semantic_fixture() -> serde_json::Value {
    serde_json::from_str(r###"{
  "phaseReceipt": {
    "sourceSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "acceptanceStatus": "PENDING_CANONICAL_HEALTH_AND_CANARY",
    "productionAccepted": false,
    "currentSixAuthorized": false
  },
  "routingReceipt": {"status":"INSTALLED","candidateSha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},
  "sourceSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "routingManifest": {"version":1,"canonicalOpsTarget":{"channel":"feishu","to":"scheduler-ops"},"ownerTargets":{},"jobFailureTargets":{}},
  "routingManifestSha256": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "beforeHealth": {
    "complete": true,
    "unknown": 0,
    "enabled": 2,
    "healthy": 1,
    "degraded": 0,
    "blocked": 1,
    "generatedAt": 20,
    "provenance": {
      "canonicalPair": true,
      "runtime": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "store": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "routing": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "incidents": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    },
    "jobs": [
      {
        "jobId": "job-quarantined",
        "state": "QUARANTINED_UNKNOWN",
        "currentOccurrence": {"occurrenceId":"occ-old","state":"outcome_unknown"},
        "currentBlocker": "OUTCOME_UNKNOWN",
        "blockedSince": 3,
        "fenceReason": "unresolved outcome_unknown occurrence contribution"
      },
      {
        "jobId": "job-other",
        "state": "HEALTHY",
        "classification": "healthy",
        "credentialReadiness": "READY",
        "currentBlocker": null,
        "fenceReason": null,
        "notificationRoute": {"status":"READY"}
      }
    ],
    "findings": [
      {"class":"ADMISSION_BLOCKED_UNKNOWN","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old"},
      {"class":"EXPECTED_RUN_MISSED","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old","derivedUnderAdmissionBlock":true}
    ]
  },
  "afterHealth": {
    "complete": true,
    "unknown": 0,
    "enabled": 2,
    "healthy": 1,
    "degraded": 0,
    "blocked": 1,
    "generatedAt": 30,
    "provenance": {
      "canonicalPair": true,
      "runtime": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "store": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "routing": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "incidents": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    },
    "jobs": [
      {
        "jobId": "job-quarantined",
        "state": "QUARANTINED_UNKNOWN",
        "currentOccurrence": {"occurrenceId":"occ-old","state":"outcome_unknown"},
        "currentBlocker": "OUTCOME_UNKNOWN",
        "blockedSince": 3,
        "fenceReason": "unresolved outcome_unknown occurrence contribution"
      },
      {
        "jobId": "job-other",
        "state": "HEALTHY",
        "classification": "healthy",
        "credentialReadiness": "READY",
        "currentBlocker": null,
        "fenceReason": null,
        "notificationRoute": {"status":"READY"}
      }
    ],
    "findings": [
      {"class":"ADMISSION_BLOCKED_UNKNOWN","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old"},
      {"class":"EXPECTED_RUN_MISSED","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old","derivedUnderAdmissionBlock":true}
    ]
  },
  "beforeStore": {
    "version": 3,
    "jobs": [
      {
        "id": "job-quarantined",
        "agentId": "agt-q",
        "logicalKey": "q",
        "name": "Q",
        "enabled": true,
        "scheduleRevision": 1,
        "revisionActivatedAtMs": 1,
        "createdAtMs": 1,
        "updatedAtMs": 1,
        "schedule": {"kind":"every","everyMs":1000,"anchorMs":1},
        "payload": {"kind":"agentTurn","message":"q"},
        "delivery": {"mode":"none"},
        "state": {}
      },
      {
        "id": "job-other",
        "agentId": "agt-other",
        "logicalKey": "other",
        "name": "Q",
        "enabled": true,
        "scheduleRevision": 1,
        "revisionActivatedAtMs": 1,
        "createdAtMs": 1,
        "updatedAtMs": 1,
        "schedule": {"kind":"every","everyMs":1000,"anchorMs":1},
        "payload": {"kind":"agentTurn","message":"q"},
        "delivery": {"mode":"none"},
        "state": {}
      }
    ],
    "occurrences": [
      {
        "occurrenceId": "occ-old",
        "runId": "run-old",
        "jobId": "job-quarantined",
        "kind": "scheduled",
        "state": "outcome_unknown",
        "executionOutcome": "unknown",
        "admittedAt": 1,
        "startedAt": 2,
        "endedAt": 3,
        "nominalScheduledAt": 1,
        "scheduleRevision": 1
      }
    ],
    "fences": {"job-quarantined":["occ-old"]}
  },
  "afterStore": {
    "version": 3,
    "jobs": [
      {
        "id": "job-quarantined",
        "agentId": "agt-q",
        "logicalKey": "q",
        "name": "Q",
        "enabled": true,
        "scheduleRevision": 1,
        "revisionActivatedAtMs": 1,
        "createdAtMs": 1,
        "updatedAtMs": 1,
        "schedule": {"kind":"every","everyMs":1000,"anchorMs":1},
        "payload": {"kind":"agentTurn","message":"q"},
        "delivery": {"mode":"none"},
        "state": {}
      },
      {
        "id": "job-other",
        "agentId": "agt-other",
        "logicalKey": "other",
        "name": "Q",
        "enabled": true,
        "scheduleRevision": 1,
        "revisionActivatedAtMs": 1,
        "createdAtMs": 1,
        "updatedAtMs": 1,
        "schedule": {"kind":"every","everyMs":1000,"anchorMs":1},
        "payload": {"kind":"agentTurn","message":"q"},
        "delivery": {"mode":"none"},
        "state": {}
      }
    ],
    "occurrences": [
      {
        "occurrenceId": "occ-old",
        "runId": "run-old",
        "jobId": "job-quarantined",
        "kind": "scheduled",
        "state": "outcome_unknown",
        "executionOutcome": "unknown",
        "admittedAt": 1,
        "startedAt": 2,
        "endedAt": 3,
        "nominalScheduledAt": 1,
        "scheduleRevision": 1
      },
      {
        "occurrenceId": "occ-canary",
        "runId": "run-canary",
        "jobId": "job-canary",
        "kind": "scheduled",
        "state": "succeeded",
        "executionOutcome": "succeeded",
        "admittedAt": 10,
        "startedAt": 11,
        "endedAt": 12,
        "nominalScheduledAt": 10,
        "scheduleRevision": 1
      },
      {
        "occurrenceId": "occ-other",
        "runId": "run-other",
        "jobId": "job-other",
        "kind": "scheduled",
        "state": "succeeded",
        "executionOutcome": "succeeded",
        "admittedAt": 10,
        "startedAt": 11,
        "endedAt": 12,
        "nominalScheduledAt": 10,
        "scheduleRevision": 1
      }
    ],
    "fences": {"job-quarantined":["occ-old"]}
  },
  "canaryJobId": "job-canary",
  "beforeStoreSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "afterStoreSha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "beforeIncidentState": {
    "version": 1,
    "incidents": {
      "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old": {
        "rootCauseClass": "RUN_STUCK_OUTCOME_UNKNOWN",
        "jobId": "job-quarantined",
        "occurrenceId": "occ-old",
        "rootIdentity": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old",
        "routeClass": "SCHEDULER_CONTROL_PLANE_INCIDENT",
        "facts": [
          {"class":"ADMISSION_BLOCKED_UNKNOWN","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old"},
          {"class":"EXPECTED_RUN_MISSED","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old","derivedUnderAdmissionBlock":true}
        ],
        "symptoms": ["ADMISSION_BLOCKED_UNKNOWN","EXPECTED_RUN_MISSED"],
        "producer": "w1",
        "episode": 1,
        "incidentId": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old|episode:1",
        "lifecycle": "OPEN",
        "transitionRevision": 1,
        "firstSeenAt": 20,
        "lastSeenAt": 20,
        "alertState": {"lifecycle":"OPEN","delivery":"PENDING","incidentKey":"occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old","lastTransitionAt":20}
      }
    },
    "outbox": {
      "3d01185608dcb149795d1319e9af8b419abefe7ba2f649eb3c3d839e496a4349": {
        "incident": {
          "rootCauseClass": "RUN_STUCK_OUTCOME_UNKNOWN",
          "jobId": "job-quarantined",
          "occurrenceId": "occ-old",
          "rootIdentity": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old",
          "routeClass": "SCHEDULER_CONTROL_PLANE_INCIDENT",
          "facts": [
            {"class":"ADMISSION_BLOCKED_UNKNOWN","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old"},
            {"class":"EXPECTED_RUN_MISSED","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old","derivedUnderAdmissionBlock":true}
          ],
          "symptoms": ["ADMISSION_BLOCKED_UNKNOWN","EXPECTED_RUN_MISSED"],
          "producer": "w1",
          "episode": 1,
          "incidentId": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old|episode:1",
          "lifecycle": "OPEN",
          "transitionRevision": 1,
          "firstSeenAt": 20,
          "lastSeenAt": 20,
          "alertState": {"lifecycle":"OPEN","delivery":"PENDING","incidentKey":"occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old","lastTransitionAt":20}
        },
        "incidentId": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old|episode:1",
        "transitionRevision": 1,
        "transitionKind": "OPEN",
        "routeClass": "SCHEDULER_CONTROL_PLANE_INCIDENT",
        "producer": "w1",
        "notificationKey": "3d01185608dcb149795d1319e9af8b419abefe7ba2f649eb3c3d839e496a4349",
        "delivery": "PENDING",
        "payloadRevision": 1
      }
    }
  },
  "afterIncidentState": {
    "version": 1,
    "incidents": {
      "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old": {
        "rootCauseClass": "RUN_STUCK_OUTCOME_UNKNOWN",
        "jobId": "job-quarantined",
        "occurrenceId": "occ-old",
        "rootIdentity": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old",
        "routeClass": "SCHEDULER_CONTROL_PLANE_INCIDENT",
        "facts": [
          {"class":"ADMISSION_BLOCKED_UNKNOWN","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old"},
          {"class":"EXPECTED_RUN_MISSED","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old","derivedUnderAdmissionBlock":true}
        ],
        "symptoms": ["ADMISSION_BLOCKED_UNKNOWN","EXPECTED_RUN_MISSED"],
        "producer": "w1",
        "episode": 1,
        "incidentId": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old|episode:1",
        "lifecycle": "OPEN",
        "transitionRevision": 1,
        "firstSeenAt": 20,
        "lastSeenAt": 20,
        "alertState": {"lifecycle":"OPEN","delivery":"PENDING","incidentKey":"occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old","lastTransitionAt":20}
      }
    },
    "outbox": {
      "3d01185608dcb149795d1319e9af8b419abefe7ba2f649eb3c3d839e496a4349": {
        "incident": {
          "rootCauseClass": "RUN_STUCK_OUTCOME_UNKNOWN",
          "jobId": "job-quarantined",
          "occurrenceId": "occ-old",
          "rootIdentity": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old",
          "routeClass": "SCHEDULER_CONTROL_PLANE_INCIDENT",
          "facts": [
            {"class":"ADMISSION_BLOCKED_UNKNOWN","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old"},
            {"class":"EXPECTED_RUN_MISSED","jobId":"job-quarantined","occurrenceId":"occ-old","runId":"run-old","derivedUnderAdmissionBlock":true}
          ],
          "symptoms": ["ADMISSION_BLOCKED_UNKNOWN","EXPECTED_RUN_MISSED"],
          "producer": "w1",
          "episode": 1,
          "incidentId": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old|episode:1",
          "lifecycle": "OPEN",
          "transitionRevision": 1,
          "firstSeenAt": 20,
          "lastSeenAt": 20,
          "alertState": {"lifecycle":"OPEN","delivery":"PENDING","incidentKey":"occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old","lastTransitionAt":20}
        },
        "incidentId": "occurrence|RUN_STUCK_OUTCOME_UNKNOWN|job-quarantined|occ-old|episode:1",
        "transitionRevision": 1,
        "transitionKind": "OPEN",
        "routeClass": "SCHEDULER_CONTROL_PLANE_INCIDENT",
        "producer": "w1",
        "notificationKey": "3d01185608dcb149795d1319e9af8b419abefe7ba2f649eb3c3d839e496a4349",
        "delivery": "PENDING",
        "payloadRevision": 1
      }
    }
  },
  "beforeIncidentSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "afterIncidentSha256": "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "runReadback": {
    "occurrences": [
      {
        "occurrenceId": "occ-canary",
        "runId": "run-canary",
        "jobId": "job-canary",
        "kind": "scheduled",
        "state": "succeeded",
        "executionOutcome": "succeeded",
        "admittedAt": 10,
        "startedAt": 11,
        "endedAt": 12,
        "nominalScheduledAt": 10,
        "scheduleRevision": 1,
        "result": {
          "final_status": "PASS",
          "counters": {"tool_calls":0,"external_effects":0},
          "notes": "SCHEDULER_NATIVE_NOOP:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        }
      }
    ],
    "events": [
      {
        "occurrenceId": "occ-canary",
        "action": "router_admission",
        "phase": "accepted",
        "evidence": {
          "executionClass": "SCHEDULER_NATIVE_NOOP",
          "sourceSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "marker": "SCHEDULER_POSTDEPLOY_CANARY_OK",
          "toolCalls": 0,
          "externalEffects": 0
        }
      }
    ]
  }
}"###).unwrap()
}
