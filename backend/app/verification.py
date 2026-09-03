"""Rule-based verification pipeline for non-critical requests
(docs/AGENT-FLOW.md sections 4-5).

Deliberately rule-based, not ML/AI: the spec is explicit that a request
should not be assumed genuine just because the text sounds believable.
These are the checks a human reviewer would mechanically apply first,
before spending judgment on the harder cases -- this pipeline runs them
so admin review starts from "here's what's missing/suspicious," not from
a blank slate.

Distinct from `admin_status` (human NGO moderation, pre-existing): this is
"does this look complete/genuine at a mechanical level," computed once at
submission time. It never fully replaces human judgment -- the best outcome
this pipeline can produce on a clean submission is 'verified', which still
sits alongside admin_status='pending' until a human actually reviews it.
"""
from __future__ import annotations

from . import config

Verification = tuple[str, list[str]]  # (verification_status, reasons)


def verify(
    category: str,
    service_details: dict | None,
    photo_url: str | None,
    requester_phone: str | None,
    is_duplicate: bool,
    proof_video_url: str | None = None,
) -> Verification:
    if is_duplicate:
        # PRD section 5: duplicate is an explicit rejection reason, not a
        # silent merge -- the ROOT stays active; this row is redundant.
        return "rejected", ["duplicate"]

    required = config.REQUIRED_SERVICE_FIELDS.get(category, [])
    details = service_details or {}
    missing = [
        field for field in required
        if not str(details.get(field, "")).strip()
    ]
    if missing:
        return "incomplete", [f"missing_field:{f}" for f in missing]

    # Evidence/authenticity signal (PRD section 4C): a photo/document, proof video, or a
    # real contact channel, is the minimum bar for "not just believable
    # text." Absent either, this stays 'pending' for a human -- it is
    # deliberately never auto-verified from text completeness alone.
    has_evidence = bool(photo_url) or bool(requester_phone) or bool(proof_video_url)
    if has_evidence:
        return "verified", []
    return "pending", ["no_evidence_signal"]
