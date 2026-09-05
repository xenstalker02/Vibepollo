#!/usr/bin/env python3
"""Synthetic regression cases; no actual private values."""
import contextlib
import io
import os
import tempfile
import unittest
from unittest import mock
import privacy_scan as scanner


def diff(added="", removed=""):
    return "diff --git a/sample b/sample\n--- a/sample\n+++ b/sample\n@@ -1 +1 @@\n-" + removed + "\n+" + added + "\n"


class PrivacyTests(unittest.TestCase):
    def test_generic_without_private_secret(self):
        marker = "-----BEGIN " + "PRIVATE KEY-----"
        self.assertIn("private key", scanner.scan(diff(marker)))

    def test_generic_tokens(self):
        for token in ("gh" + "p_" + "a" * 36, "AK" + "IA" + "A" * 16):
            self.assertTrue(scanner.scan(diff(token)))

    def test_removed_content_not_flagged(self):
        self.assertEqual([], scanner.scan(diff("safe", "gh" + "p_" + "a" * 36)))

    def test_plus_prefixed_added_content_not_lost(self):
        self.assertTrue(scanner.scan(diff("++" + "gh" + "p_" + "a" * 36)))

    def test_headers_not_scanned(self):
        self.assertEqual([], scanner.scan("+++ " + "gh" + "p_" + "a" * 36))

    def test_private_regex_and_invalid_empty_diff(self):
        self.assertEqual(["private policy"], scanner.scan(diff("SYNTHETIC_MARKER"), "SYNTHETIC_MARKER"))
        with self.assertRaises(scanner.re.error):
            scanner.scan("", "[")

    def test_personal_path_and_allowed_runner(self):
        self.assertIn("personal home path", scanner.scan(diff("/home/" + "synthetic-person/file")))
        self.assertEqual([], scanner.scan(diff("/home/runner/work/project")))

    def test_legacy_grep_syntax_fails_closed(self):
        for pattern in ("[[:alpha:]]", r"\<synthetic\>"):
            with self.assertRaises(scanner.re.error):
                scanner.scan("", pattern)

    def test_diff_failure_is_not_clean_scan(self):
        with mock.patch.object(scanner, "git", side_effect=scanner.subprocess.CalledProcessError(128, "git")):
            with self.assertRaises(scanner.subprocess.CalledProcessError):
                scanner.event_diff({"before": "a" * 40, "after": "b" * 40}, "push")

    def test_pr_uses_exact_merge_base_range(self):
        event = {"pull_request": {"base": {"sha": "a" * 40}, "head": {"sha": "b" * 40}}}
        with mock.patch.object(scanner, "git", return_value=b"") as command:
            scanner.event_diff(event, "pull_request")
        self.assertIn("a" * 40 + "..." + "b" * 40, command.call_args.args)

    def test_initial_push_scans_entire_tree(self):
        with mock.patch.object(scanner, "git", side_effect=[b"c" * 40, b""]) as command:
            scanner.event_diff({"before": "0" * 40, "after": "b" * 40}, "push")
        self.assertIn("c" * 40, command.call_args.args)

    def test_invalid_revision_rejected(self):
        with self.assertRaises(ValueError):
            scanner.event_diff({"before": "--output=bad", "after": "b" * 40}, "push")

    def run_main(self, event_name, pattern, added):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as source:
            source.write("{}")
            path = source.name
        try:
            output = io.StringIO()
            with mock.patch.dict(os.environ, {"GITHUB_EVENT_PATH": path, "GITHUB_EVENT_NAME": event_name, "PRIVACY_PATTERN": pattern}), mock.patch.object(scanner, "event_diff", return_value=diff(added)), contextlib.redirect_stdout(output):
                result = scanner.main()
            return result, output.getvalue()
        finally:
            os.unlink(path)

    def test_pr_never_evaluates_injected_private_pattern(self):
        result, output = self.run_main("pull_request", "[", "safe")
        self.assertEqual(0, result)
        self.assertIn("unavailable", output)

    def test_invalid_trusted_pattern_fails_without_disclosure(self):
        result, output = self.run_main("push", "[PRIVATE_SYNTHETIC", "safe")
        self.assertEqual(2, result)
        self.assertNotIn("PRIVATE_SYNTHETIC", output)

    def test_matching_content_never_logged(self):
        result, output = self.run_main("push", "SYNTHETIC_MARKER", "SYNTHETIC_MARKER")
        self.assertEqual(1, result)
        self.assertNotIn("SYNTHETIC_MARKER", output)


if __name__ == "__main__":
    unittest.main()
