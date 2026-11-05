"""Consistent JSON response helpers and error handlers.

Success:  {"data": ..., "meta": {...}?}
Error:    {"error": {"code": "...", "message": "...", "fields": {...}?}}
"""

import logging

from flask import jsonify
from werkzeug.exceptions import HTTPException

log = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields


def ok(data=None, status: int = 200, meta: dict | None = None):
    body = {"data": data}
    if meta is not None:
        body["meta"] = meta
    return jsonify(body), status


def error_response(status: int, code: str, message: str, fields: dict | None = None):
    err = {"code": code, "message": message}
    if fields:
        err["fields"] = fields
    return jsonify({"error": err}), status


def not_found(message: str = "Not found."):
    return ApiError(404, "not_found", message)


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(e: ApiError):
        return error_response(e.status, e.code, e.message, e.fields)

    @app.errorhandler(HTTPException)
    def handle_http(e: HTTPException):
        codes = {
            400: "bad_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            413: "payload_too_large",
            429: "rate_limited",
        }
        messages = {
            413: "The uploaded file is too large.",
            429: "Too many requests. Please slow down and try again shortly.",
        }
        code = codes.get(e.code, "http_error")
        return error_response(e.code or 500, code, messages.get(e.code, e.description or "Request failed."))

    @app.errorhandler(Exception)
    def handle_unexpected(e: Exception):
        log.exception("Unhandled error")
        return error_response(500, "server_error", "Something went wrong on our side. Please try again.")
