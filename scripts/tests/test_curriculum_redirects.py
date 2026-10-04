"""Real redirect transports, loopback destinations and synthetic keys only."""
from __future__ import annotations

import io
import json
import sys
import threading
import unittest
from email.message import Message
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import HTTPSHandler
from urllib.response import addinfourl

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import onderwijsdoelen_api_client as api
import fetch_pov_secondary_curricula as pov
from fetch_secondary_minimum_goals import SecondaryMinimumGoalsFetcher
from curriculum_fetch.sources.minimumdoelen import MinimumdoelenFetcher

KEY = "synthetic-curriculum-redirect-key"
REDIRECTS = (301, 302, 303, 307, 308)


class CurriculumRedirectTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.hits = []
        cls.code = 302
        cls.location = ""
        cls.detail_only = False
        cls.pov_success = False
        cls.secondary_success = False

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                destination = self.server is cls.destination
                cls.hits.append({"destination": destination, "path": self.path,
                                 "key": self.headers.get("x-api-key") or self.headers.get("api-key") or self.headers.get("apikey")})
                if destination or self.path.startswith("/landing"):
                    status, payload = 200, {"ok": True}
                elif (cls.detail_only or cls.pov_success) and self.path == "/list":
                    status, payload = 200, [{"id": "SYNTHETIC"}]
                elif cls.pov_success:
                    status, payload = 200, [{"code": "POV-SYNTHETIC", "titel": "De leerlingen vergelijken synthetische aantallen."}]
                elif cls.secondary_success:
                    status, payload = 200, {"items": [{"code": "SO-SYNTHETIC", "titel": "De leerlingen vergelijken synthetische aantallen.", "onderwijsniveau": "secundair onderwijs"}]}
                else:
                    status, payload = cls.code, {"ok": True}
                body = json.dumps(payload).encode()
                self.send_response(status)
                if status in REDIRECTS:
                    self.send_header("Location", cls.location)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *args):
                pass

        cls.destination = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.source = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.threads = []
        for server in (cls.destination, cls.source):
            server.daemon_threads = True
            thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
            thread.start()
            cls.threads.append(thread)
        cls.source_url = f"http://localhost:{cls.source.server_port}"
        cls.destination_url = f"http://127.0.0.1:{cls.destination.server_port}/landing"

    @classmethod
    def tearDownClass(cls):
        for server in (cls.source, cls.destination):
            server.shutdown()
            server.server_close()
        for thread in cls.threads:
            thread.join(timeout=2)

    def setUp(self):
        type(self).hits.clear()
        type(self).detail_only = False
        type(self).pov_success = False
        type(self).secondary_success = False
        type(self).location = self.destination_url

    def assert_only_initial_keyed_request(self, expected_requests=1):
        self.assertEqual(len(self.hits), expected_requests, "Redirect destination must receive no request, with or without a key")
        self.assertFalse(any(hit["destination"] or hit["path"].startswith("/landing") for hit in self.hits))
        self.assertTrue(all(hit["key"] == KEY for hit in self.hits))

    def test_urllib_rejects_cross_host_and_same_origin_redirects(self):
        for code in REDIRECTS:
            for location in (self.destination_url, self.source_url + "/landing"):
                with self.subTest(code=code, location=location):
                    self.hits.clear()
                    type(self).code, type(self).location = code, location
                    with self.assertRaises(HTTPError) as error:
                        api._get_json(self.source_url + "/start", KEY)
                    self.assertEqual(error.exception.code, code)
                    error.exception.close()
                    self.assert_only_initial_keyed_request()

    def test_real_opener_rejects_https_to_http_before_destination_request(self):
        # Only the first HTTPS transport is synthetic. The real urllib opener,
        # error processor and redirect handlers decide whether to contact the
        # actual loopback HTTP destination. No TLS validation is disabled.
        requests_seen = []
        location = self.destination_url

        class SyntheticHTTPS(HTTPSHandler):
            def https_open(self, request):
                requests_seen.append(request.get_header("X-api-key"))
                headers = Message()
                headers["Location"] = location
                response = addinfourl(io.BytesIO(b""), headers, request.full_url, 302)
                response.msg = "Found"
                return response

        with patch("urllib.request.HTTPSHandler", SyntheticHTTPS), patch("urllib.request._opener", None):
            with self.assertRaises(HTTPError) as error:
                api._get_json("https://curriculum.example.test/start", KEY)
        self.assertEqual(error.exception.code, 302)
        error.exception.close()
        self.assertEqual(requests_seen, [KEY])
        self.assertEqual(self.hits, [], "HTTPS downgrade must not contact the HTTP destination")

    def test_urllib_normal_json_request_still_sends_key(self):
        type(self).code = 200
        self.assertEqual(api._get_json(self.source_url + "/start", KEY), {"ok": True})
        self.assert_only_initial_keyed_request()

    def test_secondary_minimum_redirects_do_not_send_key_to_destination(self):
        fetcher = SecondaryMinimumGoalsFetcher(api_key=KEY, api_url=self.source_url + "/start", filters={}, timeout=2)
        self.addCleanup(fetcher.session.close)
        for code in REDIRECTS:
            with self.subTest(code=code), patch.object(fetcher, "_write") as write:
                self.hits.clear()
                type(self).code = code
                with self.assertRaisesRegex(RuntimeError, "redirect"):
                    fetcher.run()
                self.assert_only_initial_keyed_request()
                write.assert_not_called()

    def test_pov_list_and_detail_redirects_do_not_send_key_to_destination(self):
        fetcher = pov.PovCurriculumFetcher(api_key=KEY, timeout=2)
        self.addCleanup(fetcher.session.close)
        for code in REDIRECTS:
            for detail in (False, True):
                with self.subTest(code=code, detail=detail), patch.object(pov, "API_BASE", self.source_url), patch.object(fetcher, "_write") as write:
                    self.hits.clear()
                    type(self).code, type(self).detail_only = code, detail
                    with self.assertRaises(RuntimeError):
                        fetcher.run()
                    self.assert_only_initial_keyed_request(2 if detail else 1)
                    write.assert_not_called()

    def test_raw_minimum_redirects_do_not_send_key_to_destination(self):
        session = requests.Session()
        self.addCleanup(session.close)
        fetcher = MinimumdoelenFetcher(SimpleNamespace(session=session, timeout=2))
        for code in REDIRECTS:
            with self.subTest(code=code), patch("curriculum_fetch.sources.minimumdoelen.DEFAULT_API_BASE", self.source_url), patch("curriculum_fetch.sources.minimumdoelen.DEFAULT_API_PATH", "/start"):
                self.hits.clear()
                type(self).code = code
                result = fetcher._fetch_api(KEY)
                self.assert_only_initial_keyed_request()
                self.assertIsNone(result)
        self.assertNotIn("apikey", session.headers, "API key must remain per-request, never shared with public downloads")

    def test_raw_minimum_normal_json_request_still_works(self):
        type(self).code = 200
        with requests.Session() as session:
            fetcher = MinimumdoelenFetcher(SimpleNamespace(session=session, timeout=2))
            with patch("curriculum_fetch.sources.minimumdoelen.DEFAULT_API_BASE", self.source_url), patch("curriculum_fetch.sources.minimumdoelen.DEFAULT_API_PATH", "/start"):
                self.assertEqual(fetcher._fetch_api(KEY), {"ok": True})
        self.assert_only_initial_keyed_request()

    def test_pov_normal_list_and_detail_requests_still_work(self):
        type(self).pov_success = True
        fetcher = pov.PovCurriculumFetcher(api_key=KEY, timeout=2)
        self.addCleanup(fetcher.session.close)
        with patch.object(pov, "API_BASE", self.source_url), patch.object(fetcher, "_write") as write:
            records = fetcher.run()
        self.assertEqual([record["code"] for record in records], ["POV-SYNTHETIC"])
        self.assert_only_initial_keyed_request(2)
        write.assert_called_once()

    def test_secondary_minimum_normal_request_still_works(self):
        type(self).secondary_success = True
        fetcher = SecondaryMinimumGoalsFetcher(api_key=KEY, api_url=self.source_url + "/start", filters={}, timeout=2)
        self.addCleanup(fetcher.session.close)
        with patch.object(fetcher, "_write") as write:
            records = fetcher.run()
        self.assertEqual([record["code"] for record in records], ["SO-SYNTHETIC"])
        self.assert_only_initial_keyed_request()
        write.assert_called_once()
