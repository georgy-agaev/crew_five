from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class CrewFiveCliError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        stdout: str,
        stderr: str,
        exit_code: int,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.stdout = stdout
        self.stderr = stderr
        self.exit_code = exit_code
        self.code = code
        self.details = details or {}


@dataclass
class CommandResult:
    exit_code: int
    stdout: str
    stderr: str
    data: Any | None = None


def _try_parse_json(text: str) -> Any | None:
    trimmed = text.strip()
    if not trimmed:
        return None
    try:
        return json.loads(trimmed)
    except json.JSONDecodeError:
        return None


class CrewFiveRunner:
    def __init__(self, repo_root: str | Path, timeout_sec: int = 60) -> None:
        self.repo_root = Path(repo_root)
        self.timeout_sec = timeout_sec

    def run(self, args: list[str]) -> CommandResult:
        cmd = ["pnpm", "cli", *args]
        completed = subprocess.run(
            cmd,
            cwd=self.repo_root,
            capture_output=True,
            text=True,
            timeout=self.timeout_sec,
        )

        stdout = completed.stdout
        stderr = completed.stderr
        data = _try_parse_json(stdout)

        if completed.returncode == 0:
            return CommandResult(
                exit_code=completed.returncode,
                stdout=stdout,
                stderr=stderr,
                data=data,
            )

        err_payload = _try_parse_json(stderr) or {}
        error_meta = err_payload.get("error", {}) if isinstance(err_payload, dict) else {}
        raise CrewFiveCliError(
            error_meta.get("message") or stderr.strip() or "crew_five command failed",
            stdout=stdout,
            stderr=stderr,
            exit_code=completed.returncode,
            code=error_meta.get("code"),
            details=error_meta.get("details"),
        )

    def list_segments(self) -> CommandResult:
        return self.run(["segment:list", "--error-format", "json"])

    def list_campaigns(self) -> CommandResult:
        return self.run(["campaign:list", "--error-format", "json"])

    def list_campaigns_by_icp(self, *, icp_profile_id: str) -> CommandResult:
        return self.run(
            [
                "campaign:list",
                "--icp-profile-id",
                icp_profile_id,
                "--error-format",
                "json",
            ]
        )

    def enrich_segment(
        self,
        *,
        segment_id: str,
        provider: str | None = None,
        limit: int | None = None,
        dry_run: bool = False,
        run_now: bool = False,
        max_age_days: int | None = None,
        force_refresh: bool = False,
    ) -> CommandResult:
        args = ["enrich:run", "--segment-id", segment_id, "--error-format", "json"]
        if provider:
            args.extend(["--provider", provider])
        if limit is not None:
            args.extend(["--limit", str(limit)])
        if max_age_days is not None:
            args.extend(["--max-age-days", str(max_age_days)])
        if dry_run:
            args.append("--dry-run")
        if run_now:
            args.append("--run-now")
        if force_refresh:
            args.append("--force-refresh")
        return self.run(args)

    def create_campaign(self, *, name: str, segment_id: str, snapshot_mode: str = "refresh") -> CommandResult:
        return self.run(
            [
                "campaign:create",
                "--name",
                name,
                "--segment-id",
                segment_id,
                "--snapshot-mode",
                snapshot_mode,
                "--error-format",
                "json",
            ]
        )

    def save_draft(self, payload: dict[str, Any] | list[dict[str, Any]]) -> CommandResult:
        return self.run(
            [
                "draft:save",
                "--payload",
                json.dumps(payload),
                "--error-format",
                "json",
            ]
        )

    def load_drafts(
        self,
        *,
        campaign_id: str,
        status: str | None = None,
        limit: int | None = None,
    ) -> CommandResult:
        args = ["draft:load", "--campaign-id", campaign_id, "--error-format", "json"]
        if status:
            args.extend(["--status", status])
        if limit is not None:
            args.extend(["--limit", str(limit)])
        return self.run(args)

    def load_drafts_for_send(
        self,
        *,
        campaign_id: str,
        status: str | None = None,
        limit: int | None = None,
    ) -> CommandResult:
        args = [
            "draft:load",
            "--campaign-id",
            campaign_id,
            "--include-recipient-context",
            "--error-format",
            "json",
        ]
        if status:
            args.extend(["--status", status])
        if limit is not None:
            args.extend(["--limit", str(limit)])
        return self.run(args)

    def update_draft_status(
        self,
        *,
        draft_id: str,
        status: str,
        reviewer: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CommandResult:
        args = [
            "draft:update-status",
            "--draft-id",
            draft_id,
            "--status",
            status,
            "--error-format",
            "json",
        ]
        if reviewer:
            args.extend(["--reviewer", reviewer])
        if metadata:
            args.extend(["--metadata", json.dumps(metadata)])
        return self.run(args)

    def record_outbound(
        self,
        *,
        draft_id: str,
        provider: str = "imap_mcp",
        provider_message_id: str | None = None,
        sender_identity: str | None = None,
        recipient_email: str | None = None,
        recipient_email_source: str | None = None,
        recipient_email_kind: str | None = None,
        status: str = "sent",
        sent_at: str | None = None,
        error: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CommandResult:
        payload = {
            "draftId": draft_id,
            "provider": provider,
            "providerMessageId": provider_message_id,
            "senderIdentity": sender_identity,
            "recipientEmail": recipient_email,
            "recipientEmailSource": recipient_email_source,
            "recipientEmailKind": recipient_email_kind,
            "status": status,
            "sentAt": sent_at,
            "error": error,
            "metadata": metadata,
        }
        return self.run(
            [
                "email:record-outbound",
                "--payload",
                json.dumps(payload),
                "--error-format",
                "json",
            ]
        )


if __name__ == "__main__":
    runner = CrewFiveRunner(Path.cwd())
    result = runner.list_segments()
    print(f"segments={len(result.data or [])}")
