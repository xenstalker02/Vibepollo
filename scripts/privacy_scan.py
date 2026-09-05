#!/usr/bin/env python3
"""Scan added diff lines without printing content or private patterns.

PRs always run generic rules without secrets. On trusted default-branch pushes,
PRIVACY_PATTERN optionally adds a Python regular expression.
"""
import json
import os
import re
import subprocess
import sys

RULES = (
    ("private key", re.compile(r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----")),
    ("GitHub credential", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b")),
    ("AWS access key", re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b")),
    ("personal home path", re.compile(r"(?i)(?:[A-Z]:[\\/]+Users[\\/]+|/home/|/Users/)(?!Public\b|Default\b|runner\b|user\b|username\b|example\b)[A-Za-z0-9_.-]+")),
)


def added_lines(diff):
    in_hunk = False
    for line in diff.splitlines():
        if line.startswith("diff --git "):
            in_hunk = False
        elif line.startswith("@@ "):
            in_hunk = True
        elif in_hunk and line.startswith("+"):
            yield line[1:]


def scan(diff, private_pattern=""):
    # Compile before scanning, including empty diffs: malformed policy must fail.
    # Refuse common grep-only syntax rather than silently weakening an old ERE.
    if any(token in private_pattern for token in ("[:", "[.", "[=", r"\<", r"\>")):
        raise re.error("unsupported private regex syntax")
    private = re.compile(private_pattern) if private_pattern else None
    findings = set()
    for line in added_lines(diff):
        for name, pattern in RULES:
            if pattern.search(line):
                findings.add(name)
        if private and private.search(line):
            findings.add("private policy")
    return sorted(findings)


def git(*args, input=None):
    return subprocess.run(
        ["git", *args], input=input, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, check=True
    ).stdout


def revision(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-fA-F]{40,64}", value):
        raise ValueError("invalid revision")
    return value


def event_diff(event, event_name):
    if event_name == "pull_request":
        base = revision(event["pull_request"]["base"]["sha"])
        head = revision(event["pull_request"]["head"]["sha"])
        comparison = [base + "..." + head]
    elif event_name == "push":
        before = revision(event["before"])
        head = revision(event["after"])
        if set(before) == {"0"}:
            before = git("hash-object", "-t", "tree", "--stdin", input=b"").decode().strip()
        comparison = [before, head]
    else:
        raise ValueError("unsupported event")
    return git("diff", "--no-ext-diff", "--no-textconv", "--unified=0",
               *comparison, "--").decode("utf-8", errors="replace")


def main():
    try:
        with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as source:
            event = json.load(source)
        event_name = os.environ["GITHUB_EVENT_NAME"]
        private = os.environ.get("PRIVACY_PATTERN", "") if event_name == "push" else ""
        findings = scan(event_diff(event, event_name), private)
    except re.error:
        print("ERROR: optional private regex is invalid; scan failed (pattern withheld).")
        return 2
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError):
        print("ERROR: unable to build or scan the required diff; scan failed.")
        return 2
    print("Generic privacy scan completed.")
    print("Optional private policy: " + ("evaluated." if private else "unavailable; personal identifiers are not fully covered."))
    if findings:
        print("FAIL: sensitive data detected; content and locations withheld.")
        return 1
    print("PASS: no matches in the evaluated rules; this is not proof that all private data is absent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
